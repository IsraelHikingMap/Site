using GeoAPI.CoordinateSystems.Transformations;
using GeoAPI.Geometries;
using IsraelHiking.API;
using IsraelHiking.API.Controllers;
using IsraelHiking.Common;
using IsraelHiking.DataAccess;
using IsraelHiking.DataAccess.Database;
using IsraelHiking.DataAccessInterfaces;
using IsraelTransverseMercator;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Rewrite;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.FileProviders;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using Microsoft.IdentityModel.Tokens;
using NetTopologySuite.Geometries;
using NetTopologySuite.IO.Converters;
using Swashbuckle.AspNetCore.Swagger;
using System;
using System.IO;

namespace IsraelHiking.Web
{
    public class Startup
    {
        // This method gets called by the runtime. Use this method to add services to the container.
        // For more information on how to configure your application, visit https://go.microsoft.com/fwlink/?LinkID=398940
        public void ConfigureServices(IServiceCollection services)
        {
            services.AddMvc().AddJsonOptions(options =>
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
            services.AddOptions();
            var config = new ConfigurationBuilder()
                .AddJsonFile("appsettings.json", optional: false, reloadOnChange: true)
                .AddJsonFile("appsettings.{env.EnvironmentName}.json", optional: true)
                .Build();
            services.Configure<ConfigurationData>(config);

            services.AddSingleton((serviceProvider) => serviceProvider.GetRequiredService<ILoggerFactory>().CreateLogger("IHM"));
            services.AddTransient<IFileProvider, PhysicalFileProvider>((serviceProvider) =>
            {
                var binariesFolder = serviceProvider.GetService<IOptions<ConfigurationData>>().Value.BinariesFolder;
                var path = Path.Combine(Directory.GetCurrentDirectory(), binariesFolder);
                return new PhysicalFileProvider(path);
            });

            services.AddIHMDataAccess();
            services.AddIHMApi();

            services.AddTransient<IMathTransform, ItmWgs84MathTransfrom>((serviceProvider) => new ItmWgs84MathTransfrom(false));
            services.AddSingleton<IGeometryFactory, GeometryFactory>((serviceProvider) => new GeometryFactory(new PrecisionModel(100000000)));
            services.AddSwaggerGen(c =>
            {
                c.SwaggerDoc("v1", new Info { Title = "Israel Hiking API", Version = "v1" });
            });
            services.AddEntityFrameworkSqlite().AddDbContext<IsraelHikingDbContext>();
            services.AddDirectoryBrowser();
        }

        // This method gets called by the runtime. Use this method to configure the HTTP request pipeline.
        public void Configure(IApplicationBuilder app, IHostingEnvironment env, ILoggerFactory loggerFactory)
        {
            loggerFactory.AddConsole();
            loggerFactory.AddFile("Logs/IsraelHiking-{Date}.log");

            var rewriteOptions = new RewriteOptions()
                .AddRewrite(".*escaped_fragment_=/%3Fs=(.*)", "api/opengraph/$1", skipRemainingRules: false);

            if (env.IsDevelopment())
            {
                app.UseDeveloperExceptionPage();
            }
            else
            {
                rewriteOptions.AddRedirectToHttps();
            }
            app.UseRewriter(rewriteOptions);

            var jwtBearerOptions = new JwtBearerOptions();
            jwtBearerOptions.SecurityTokenValidators.Clear();
            jwtBearerOptions.SecurityTokenValidators.Add(app.ApplicationServices.GetRequiredService<ISecurityTokenValidator>());
            app.UseJwtBearerAuthentication(jwtBearerOptions);

            app.UseMvc();
            app.UseDefaultFiles();
            app.UseStaticFiles();
            app.UseDirectoryBrowser(new DirectoryBrowserOptions()
            {
                FileProvider = new PhysicalFileProvider(Path.Combine(Directory.GetCurrentDirectory(), @"bin")),
                RequestPath = new PathString("/bin"),
                Formatter = new BootstrapFontAwesomeDirectoryFormatter(app.ApplicationServices.GetRequiredService<IFileSystemHelper>())
            });
            app.UseSwagger();
            app.UseSwaggerUI(c =>
            {
                c.SwaggerEndpoint("/swagger/v1/swagger.json", "Israel Hiking API V1");
            });
            InitializeServices(app.ApplicationServices);
        }

        private void InitializeServices(IServiceProvider container)
        {
            var logger = container.GetRequiredService<ILogger>();
            logger.LogInformation("Initializing Elevation data and Elastic Search Service");
            container.GetRequiredService<IElasticSearchGateway>().Initialize();
            container.GetRequiredService<IElevationDataStorage>().Initialize().ContinueWith(task => logger.LogInformation("Finished loading elevation data from files."));
        }
    }
}
