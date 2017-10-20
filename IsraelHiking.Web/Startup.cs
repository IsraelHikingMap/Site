using GeoAPI.Geometries;
using IsraelHiking.API;
using IsraelHiking.API.Controllers;
using IsraelHiking.API.Swagger;
using IsraelHiking.Common;
using IsraelHiking.DataAccess;
using IsraelHiking.DataAccess.Database;
using IsraelHiking.DataAccessInterfaces;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc.ModelBinding;
using Microsoft.AspNetCore.Rewrite;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.FileProviders;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using Microsoft.IdentityModel.Tokens;
using NetTopologySuite.Features;
using NetTopologySuite.Geometries;
using NetTopologySuite.IO.Converters;
using NLog.Extensions.Logging;
using NLog.Web;
using Swashbuckle.AspNetCore.Swagger;
using System;
using System.IO;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.StaticFiles;

namespace IsraelHiking.Web
{
    public class Startup
    {
        private readonly bool _isDevelopment;
        private readonly IConfigurationRoot _nonPublicConfiguration;

        public Startup(IHostingEnvironment env)
        {
            _isDevelopment = env.IsDevelopment();
            var builder = new ConfigurationBuilder();
            builder.AddUserSecrets<NonPublicConfigurationData>();
            _nonPublicConfiguration = builder.Build();
        }

        // This method gets called by the runtime. Use this method to add services to the container.
        // For more information on how to configure your application, visit https://go.microsoft.com/fwlink/?LinkID=398940
        public void ConfigureServices(IServiceCollection services)
        {
            services.AddIHMDataAccess();
            services.AddIHMApi();
            services.AddSingleton<ISecurityTokenValidator, OsmAccessTokenValidator>();
            services.AddSingleton<IGeometryFactory, GeometryFactory>(serviceProvider => new GeometryFactory(new PrecisionModel(100000000)));
            services.AddSingleton<IPostConfigureOptions<JwtBearerOptions>, JwtBearerOptionsValidatorConfigureOptions>();
            services.AddMvc(options =>
            {
                options.ModelMetadataDetailsProviders.Add(new SuppressChildValidationMetadataProvider(typeof(Feature)));
                options.ModelMetadataDetailsProviders.Add(new SuppressChildValidationMetadataProvider(typeof(PointOfInterestExtended)));
            }).AddJsonOptions(options =>
            {
                options.SerializerSettings.Converters.Add(new CoordinateConverter());
                options.SerializerSettings.Converters.Add(new GeometryConverter());
                options.SerializerSettings.Converters.Add(new FeatureCollectionConverter());
                options.SerializerSettings.Converters.Add(new FeatureConverter());
                options.SerializerSettings.Converters.Add(new AttributesTableConverter());
                options.SerializerSettings.Converters.Add(new ICRSObjectConverter());
                options.SerializerSettings.Converters.Add(new GeometryArrayConverter());
                options.SerializerSettings.Converters.Add(new EnvelopeConverter());
            });
            services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme).AddJwtBearer();
            services.AddCors();
            services.AddOptions();

            var config = new ConfigurationBuilder()
                .AddJsonFile(_isDevelopment ? "appsettings.json" : "appsettings.Production.json", optional: false, reloadOnChange: true)
                .Build();
            services.Configure<ConfigurationData>(config);
            services.Configure<NonPublicConfigurationData>(_nonPublicConfiguration);

            services.AddSingleton(serviceProvider => serviceProvider.GetRequiredService<ILoggerFactory>().CreateLogger("IHM"));
            var binariesFolder = "";
            services.AddTransient<IFileProvider, PhysicalFileProvider>((serviceProvider) =>
            {
                binariesFolder = GetBinariesFolder(serviceProvider);
                return new PhysicalFileProvider(binariesFolder);
            });

            services.AddSwaggerGen(c =>
            {
                c.SwaggerDoc("v1", new Info { Title = "Israel Hiking API", Version = "v1" });
                c.SchemaFilter<FeatureExampleFilter>();
                c.SchemaFilter<FeatureCollectionExampleFilter>();
                c.OperationFilter<AssignOAuthSecurityRequirements>();
                c.IncludeXmlComments(Path.Combine(binariesFolder, "israelhiking.API.xml"));
            });
            services.AddEntityFrameworkSqlite().AddDbContext<IsraelHikingDbContext>();
            services.AddDirectoryBrowser();
        }

        // This method gets called by the runtime. Use this method to configure the HTTP request pipeline.
        public void Configure(IApplicationBuilder app, IHostingEnvironment env, ILoggerFactory loggerFactory)
        {
            env.ConfigureNLog("IsraelHiking.Web.nlog");
            loggerFactory.AddNLog();

            var rewriteOptions = new RewriteOptions();
            rewriteOptions.Rules.Add(new RewriteWithQueryRule(".*_escaped_fragment_=%2F%3Fs%3D(.*)", "api/opengraph/$1", false));

            if (env.IsDevelopment())
            {
                app.UseDeveloperExceptionPage();
            }
            else
            {
                rewriteOptions.AddRedirectToHttps();
            }
            app.UseRewriter(rewriteOptions);

            app.UseCors(builder =>
            {
                builder.AllowAnyOrigin().AllowAnyMethod().AllowAnyHeader().AllowCredentials();
            });
            app.UseAuthentication();
            app.UseMvc();
            SetupStaticFiles(app);

            app.UseSwagger();
            app.UseSwaggerUI(c =>
            {
                c.SwaggerEndpoint("/swagger/v1/swagger.json", "Israel Hiking API V1");
            });

            app.Run(context =>
            {
                context.Response.StatusCode = 404;
                context.Response.ContentType = "text/html";
                var file = env.WebRootFileProvider.GetFileInfo("/resource-not-found.html");
                context.Response.ContentLength = file.Length;
                return context.Response.SendFileAsync(file);
            });
            InitializeServices(app.ApplicationServices);
        }

        private static void SetupStaticFiles(IApplicationBuilder app)
        {
            app.UseDefaultFiles();
            var configurationData = app.ApplicationServices.GetRequiredService<IOptions<ConfigurationData>>().Value;
            var fileExtensionContentTypeProvider = new FileExtensionContentTypeProvider();
            fileExtensionContentTypeProvider.Mappings.Add(".db", "application/octet-stream");
            foreach (var directory in configurationData.ListingDictionary)
            {
                var fileServerOptions = new FileServerOptions
                {
                    FileProvider = new PhysicalFileProvider(directory.Value),
                    RequestPath = new PathString("/" + directory.Key),
                    EnableDirectoryBrowsing = true,
                    DirectoryBrowserOptions =
                    {
                        FileProvider = new PhysicalFileProvider(directory.Value),
                        RequestPath = new PathString("/" + directory.Key),
                        Formatter = new BootstrapFontAwesomeDirectoryFormatter(app.ApplicationServices
                            .GetRequiredService<IFileSystemHelper>())
                    },
                    StaticFileOptions = { ContentTypeProvider = fileExtensionContentTypeProvider },
                };
                app.UseFileServer(fileServerOptions);
            }
            // serve https certificate folder
            var wellKnownFolder = Path.Combine(Directory.GetCurrentDirectory(), ".well-known");
            if (Directory.Exists(wellKnownFolder))
            {
                app.UseStaticFiles(new StaticFileOptions
                {
                    FileProvider = new PhysicalFileProvider(wellKnownFolder),
                    RequestPath = new PathString("/.well-known"),
                    ServeUnknownFileTypes = true // serve extensionless file
                });
            }
            // wwwroot
            app.UseStaticFiles();
        }

        private void InitializeServices(IServiceProvider serviceProvider)
        {
            var logger = serviceProvider.GetRequiredService<ILogger>();
            logger.LogInformation("Initializing Elevation data and Elastic Search Service");
            serviceProvider.GetRequiredService<IElasticSearchGateway>().Initialize();
            serviceProvider.GetRequiredService<IElevationDataStorage>().Initialize().ContinueWith(task => logger.LogInformation("Finished loading elevation data from files."));
            serviceProvider.GetRequiredService<IWikipediaGateway>().Initialize().ContinueWith(task => logger.LogInformation("Finished loading wikipedia gateway."));
        }

        private string GetBinariesFolder(IServiceProvider serviceProvider)
        {
            var binariesFolder = serviceProvider.GetService<IOptions<ConfigurationData>>().Value.BinariesFolder;
            return Path.Combine(Directory.GetCurrentDirectory(), binariesFolder);
        }
    }
}
