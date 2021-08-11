using AspNetCore.Proxy;
using IsraelHiking.API;
using IsraelHiking.API.Controllers;
using IsraelHiking.API.Services;
using IsraelHiking.API.Swagger;
using IsraelHiking.Common.Configuration;
using IsraelHiking.Common.Poi;
using IsraelHiking.DataAccess;
using IsraelHiking.DataAccessInterfaces;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc.ModelBinding;
using Microsoft.AspNetCore.StaticFiles;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.FileProviders;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using Microsoft.IdentityModel.Tokens;
using Microsoft.OpenApi.Models;
using NeoSmart.Caching.Sqlite;
using NetTopologySuite.Features;
using NetTopologySuite.Geometries;
using NetTopologySuite.IO;
using Newtonsoft.Json.Converters;
using OsmSharp.IO.API;
using System;
using System.Collections.Generic;
using System.Globalization;
using System.IO;
using System.Linq;
using System.Net.Http;
using System.Threading.Tasks;

namespace IsraelHiking.Web
{
    public class Startup
    {
        private readonly bool _isDevelopment;
        private readonly IConfigurationRoot _nonPublicConfiguration;

        public Startup(IWebHostEnvironment env)
        {
            _isDevelopment = env.IsDevelopment();
            var builder = new ConfigurationBuilder();
            if (_isDevelopment)
            {
                builder.AddUserSecrets<NonPublicConfigurationData>();
            }
            else
            {
                builder.AddJsonFile("nonPublic.json");
            }
            _nonPublicConfiguration = builder.Build();
        }

        // This method gets called by the runtime. Use this method to add services to the container.
        // For more information on how to configure your application, visit https://go.microsoft.com/fwlink/?LinkID=398940
        public void ConfigureServices(IServiceCollection services)
        {
            services.AddProxies();
            services.AddResponseCompression();
            services.AddMemoryCache();
            services.AddDetection();
            services.AddHttpClient();
            services.AddIHMDataAccess();
            services.AddIHMApi();
            services.AddSqliteCache(@"./cache.sqlite");
            services.AddSingleton<ISecurityTokenValidator, OsmAccessTokenValidator>();
            services.AddSingleton<IClientsFactory>(serviceProvider =>
                new ClientsFactory(serviceProvider.GetRequiredService<ILogger>(),
                serviceProvider.GetRequiredService<IHttpClientFactory>().CreateClient(),
                serviceProvider.GetRequiredService<IOptions<ConfigurationData>>().Value.OsmConfiguration.BaseAddress + "/api/"));
            var geometryFactory = new GeometryFactory(new PrecisionModel(100000000));
            services.AddSingleton<GeometryFactory, GeometryFactory>(serviceProvider => geometryFactory);
            services.AddSingleton<IPostConfigureOptions<JwtBearerOptions>, JwtBearerOptionsValidatorConfigureOptions>();
            services.AddControllers(options =>
            {
                options.ModelMetadataDetailsProviders.Add(new SuppressChildValidationMetadataProvider(typeof(Feature)));
                options.ModelMetadataDetailsProviders.Add(new SuppressChildValidationMetadataProvider(typeof(PointOfInterestExtended)));
            }).AddNewtonsoftJson(options =>
            {
                foreach (var converter in GeoJsonSerializer.Create(geometryFactory, 3).Converters)
                {
                    options.SerializerSettings.Converters.Add(converter);
                }
                options.SerializerSettings.Converters.Add(new IsoDateTimeConverter
                {
                    DateTimeStyles = DateTimeStyles.AdjustToUniversal
                });
            });
            services.AddAuthentication(options =>
            {
                options.DefaultAuthenticateScheme = JwtBearerDefaults.AuthenticationScheme;
                options.DefaultChallengeScheme = JwtBearerDefaults.AuthenticationScheme;
            }).AddJwtBearer();
            services.AddCors();
            services.AddOptions();

            var config = new ConfigurationBuilder()
                .AddJsonFile("appsettings.json", optional: false, reloadOnChange: true)
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
                c.SwaggerDoc("v1", new OpenApiInfo { Title = "Israel Hiking API", Version = GetType().Assembly.GetName().Version.ToString() });
                c.SchemaFilter<FeatureExampleFilter>();
                c.SchemaFilter<FeatureCollectionExampleFilter>();
                c.AddSecurityDefinition("Bearer",
                    new OpenApiSecurityScheme
                    {
                        Description = "JWT Authorization header using the Bearer scheme - need OSM token and secret joined by ';'",
                        Type = SecuritySchemeType.Http,
                        Scheme = "bearer",
                        In = ParameterLocation.Header
                    }
                );
                c.OperationFilter<AssignOAuthSecurityRequirements>();
                c.IncludeXmlComments(Path.Combine(binariesFolder, "IsraelHiking.API.xml"));
            });
            services.AddDirectoryBrowser();
        }

        // This method gets called by the runtime. Use this method to configure the HTTP request pipeline.
        public void Configure(IApplicationBuilder app, IWebHostEnvironment env)
        {
            if (_isDevelopment)
            {
                app.UseDeveloperExceptionPage();
            }
            else
            {
                app.UseWhen(context => !context.Request.Path.StartsWithSegments("/.well-known/acme-challenge"), httpApp =>
                {
                    httpApp.UseHttpsRedirection();
                });
            }
            app.UseResponseCompression();
            app.UseRouting();
            app.UseCors(builder =>
            {
                builder.AllowAnyOrigin().AllowAnyMethod().AllowAnyHeader();//.AllowCredentials();
            });
            app.UseAuthentication();
            app.UseAuthorization();
            app.UseEndpoints(endpoints =>
            {
                endpoints.MapControllers();
            });
            SetupStaticFilesAndProxies(app);

            app.UseSwagger();
            app.UseSwaggerUI(c =>
            {
                c.SwaggerEndpoint("/swagger/v1/swagger.json", "Israel Hiking API V1");
            });
            // This should be the last middleware
            app.UseMiddleware<NonApiMiddleware>();
            InitializeServices(app.ApplicationServices);
        }

        private static void SetupStaticFilesAndProxies(IApplicationBuilder app)
        {
            app.UseDefaultFiles();
            var configurationData = app.ApplicationServices.GetRequiredService<IOptions<ConfigurationData>>().Value;
            var fileExtensionContentTypeProvider = new FileExtensionContentTypeProvider();
            fileExtensionContentTypeProvider.Mappings.Add(".pbf", "application/x-protobuf");
            fileExtensionContentTypeProvider.Mappings.Add(".db", "application/octet-stream");
            fileExtensionContentTypeProvider.Mappings.Add(".geojson", "application/json");

            app.UseProxies(proxies =>
            {
                // HM TODO: remove this section after HTTP/2 issue is resolved
                foreach (var proxyEntry in configurationData.ProxiesDictionaryCleared ?? new Dictionary<string, string>())
                {
                    proxies.Map(proxyEntry.Key,
                        proxy => proxy.UseHttp((_, args) =>
                        {
                            var targetAddress = proxyEntry.Value;
                            foreach (var argValuePair in args)
                            {
                                targetAddress = targetAddress.Replace("{" + argValuePair.Key + "}", argValuePair.Value.ToString());
                            }
                            return targetAddress;
                        }, options => options.WithAfterReceive((context, response) =>
                        {
                            response.Headers.Clear();
                            return Task.CompletedTask;
                        })
                    ));
                }

                foreach (var proxyEntry in configurationData.ProxiesDictionary ?? new Dictionary<string, string>())
                {
                    proxies.Map(proxyEntry.Key,
                        proxy => proxy.UseHttp((_, args) =>
                        {
                            var targetAddress = proxyEntry.Value;
                            foreach (var argValuePair in args)
                            {
                                targetAddress = targetAddress.Replace("{" + argValuePair.Key + "}", argValuePair.Value.ToString());
                            }
                            return targetAddress;
                        }
                    ));
                }
            });

            foreach (var directory in configurationData.ListingDictionary)
            {
                var fullPath = Path.IsPathRooted(directory.Value) ? directory.Value : Path.GetFullPath(Path.Combine(configurationData.BinariesFolder, directory.Value));
                var fileServerOptions = new FileServerOptions
                {
                    FileProvider = new PhysicalFileProvider(fullPath),
                    RequestPath = new PathString("/" + directory.Key),
                    EnableDirectoryBrowsing = true,
                    DirectoryBrowserOptions =
                    {
                        FileProvider = new PhysicalFileProvider(fullPath),
                        RequestPath = new PathString("/" + directory.Key),
                        Formatter = new BootstrapFontAwesomeDirectoryFormatter(app.ApplicationServices
                            .GetRequiredService<IFileSystemHelper>())
                    },
                    StaticFileOptions = {
                        OnPrepareResponse = GetPrepareCORSResponse(),
                        ContentTypeProvider = fileExtensionContentTypeProvider
                    },
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
                    ServeUnknownFileTypes = true, // serve extensionless file
                    DefaultContentType = "application/json"
                });
            }

            // wwwroot
            app.UseStaticFiles(new StaticFileOptions
            {
                OnPrepareResponse = GetPrepareCORSResponse(),
                ContentTypeProvider = fileExtensionContentTypeProvider
            });
        }

        private static Action<StaticFileResponseContext> GetPrepareCORSResponse()
        {
            return (StaticFileResponseContext ctx) =>
            {
                if (ctx.Context.Response.Headers.Keys.Contains("Access-Control-Allow-Origin"))
                {
                    ctx.Context.Response.Headers.Remove("Access-Control-Allow-Origin");
                }
                ctx.Context.Response.Headers.Append("Access-Control-Allow-Origin", "*");
                ctx.Context.Response.Headers.Append("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
            };
        }

        private void InitializeServices(IServiceProvider serviceProvider)
        {
            var logger = serviceProvider.GetRequiredService<ILogger>();
            logger.LogInformation("-----------------------------------------------");
            logger.LogInformation("Initializing singleton services");
            var initializableServices = serviceProvider.GetServices<IInitializable>();
            foreach (var service in initializableServices)
            {
                service.Initialize();
            }
        }

        private string GetBinariesFolder(IServiceProvider serviceProvider)
        {
            var binariesFolder = serviceProvider.GetService<IOptions<ConfigurationData>>().Value.BinariesFolder;
            return Path.Combine(Directory.GetCurrentDirectory(), binariesFolder);
        }
    }
}
