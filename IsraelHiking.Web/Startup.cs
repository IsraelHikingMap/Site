using GeoAPI.CoordinateSystems.Transformations;
using GeoAPI.Geometries;
using IsraelHiking.API;
using IsraelHiking.API.Controllers;
using IsraelHiking.API.Swagger;
using IsraelHiking.Common;
using IsraelHiking.DataAccess;
using IsraelHiking.DataAccess.Database;
using IsraelHiking.DataAccessInterfaces;
using IsraelTransverseMercator;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Http.Extensions;
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
using Swashbuckle.AspNetCore.Swagger;
using System;
using System.IO;
using System.Text.RegularExpressions;

namespace IsraelHiking.Web
{
    // HM TODO: workaround untill issue iw resolved:
    // https://github.com/aspnet/BasicMiddleware/issues/220

    public class RewriteWithQueryRule : IRule
    {
        private readonly TimeSpan _regexTimeout = TimeSpan.FromSeconds(1);
        public Regex InitialMatch { get; }
        public string Replacement { get; }
        public bool StopProcessing { get; }
        public RewriteWithQueryRule(string regex, string replacement, bool stopProcessing)
        {
            if (string.IsNullOrEmpty(regex))
            {
                throw new ArgumentException(nameof(regex));
            }

            if (string.IsNullOrEmpty(replacement))
            {
                throw new ArgumentException(nameof(replacement));
            }

            InitialMatch = new Regex(regex, RegexOptions.Compiled | RegexOptions.CultureInvariant, _regexTimeout);
            Replacement = replacement;
            StopProcessing = stopProcessing;
        }

        public virtual void ApplyRule(RewriteContext context)
        {
            var pathWithQuery = context.HttpContext.Request.Path + context.HttpContext.Request.QueryString;
            Match initMatchResults;
            if (pathWithQuery == PathString.Empty)
            {
                initMatchResults = InitialMatch.Match(pathWithQuery.ToString());
            }
            else
            {
                initMatchResults = InitialMatch.Match(pathWithQuery.ToString().Substring(1));
            }
            if (initMatchResults.Success)
            {
                var result = initMatchResults.Result(Replacement);
                var request = context.HttpContext.Request;

                if (StopProcessing)
                {
                    context.Result = RuleResult.SkipRemainingRules;
                }

                if (string.IsNullOrEmpty(result))
                {
                    result = "/";
                }

                if (result.IndexOf("://", StringComparison.Ordinal) >= 0)
                {
                    string scheme;
                    HostString host;
                    PathString pathString;
                    QueryString query;
                    FragmentString fragment;
                    UriHelper.FromAbsolute(result, out scheme, out host, out pathString, out query, out fragment);

                    request.Scheme = scheme;
                    request.Host = host;
                    request.Path = pathString;
                    request.QueryString = query.Add(request.QueryString);
                }
                else
                {
                    var split = result.IndexOf('?');
                    if (split >= 0)
                    {
                        var newPath = result.Substring(0, split);
                        if (newPath[0] == '/')
                        {
                            request.Path = PathString.FromUriComponent(newPath);
                        }
                        else
                        {
                            request.Path = PathString.FromUriComponent('/' + newPath);
                        }
                        request.QueryString = request.QueryString.Add(
                            QueryString.FromUriComponent(
                                result.Substring(split)));
                    }
                    else
                    {
                        if (result[0] == '/')
                        {
                            request.Path = PathString.FromUriComponent(result);
                        }
                        else
                        {
                            request.Path = PathString.FromUriComponent('/' + result);
                        }
                    }
                }

                //context.Logger?.RewriteSummary(result);
            }
        }
    }

    public class Startup
    {
        // This method gets called by the runtime. Use this method to add services to the container.
        // For more information on how to configure your application, visit https://go.microsoft.com/fwlink/?LinkID=398940
        public void ConfigureServices(IServiceCollection services)
        {
            services.AddMvc(options =>
            {
                options.ModelMetadataDetailsProviders.Add(new SuppressChildValidationMetadataProvider(typeof(Feature)));
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
            services.AddCors();
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
            services.AddSingleton<ISecurityTokenValidator, OsmAccessTokenValidator>();
            services.AddSwaggerGen(c =>
            {
                c.SwaggerDoc("v1", new Info { Title = "Israel Hiking API", Version = "v1" });
                c.SchemaFilter<FeatureExampleFilter>();
                c.SchemaFilter<FeatureCollectionExampleFilter>();
                c.OperationFilter<AssignOAuthSecurityRequirements>();
            });
            services.AddEntityFrameworkSqlite().AddDbContext<IsraelHikingDbContext>();
            services.AddDirectoryBrowser();
        }

        // This method gets called by the runtime. Use this method to configure the HTTP request pipeline.
        public void Configure(IApplicationBuilder app, IHostingEnvironment env, ILoggerFactory loggerFactory)
        {
            loggerFactory.AddConsole();
            loggerFactory.AddFile("Logs/IsraelHiking-{Date}.log");

            var rewriteOptions = new RewriteOptions();
            rewriteOptions.Rules.Add(new RewriteWithQueryRule(".*_escaped_fragment_=%2F%3Fs%3D(.*)", "api/opengraph/$1", false));
            //.AddRewrite(".*escaped_fragment_=/%3Fs=(.*)", "api/opengraph/$1", skipRemainingRules: false)
            //.AddRewrite(".*_escaped_fragment_=%2F%3Fs%3D(.*)", "api/opengraph/$1", skipRemainingRules: false)

            if (env.IsDevelopment())
            {
                app.UseDeveloperExceptionPage();
            }
            else
            {
                //rewriteOptions.AddRedirectToHttps();
            }
            app.UseRewriter(rewriteOptions);

            app.UseCors(builder => {
                builder.AllowAnyOrigin().AllowAnyMethod().AllowAnyHeader().AllowCredentials();
            });

            var jwtBearerOptions = new JwtBearerOptions();
            jwtBearerOptions.SecurityTokenValidators.Clear();
            jwtBearerOptions.SecurityTokenValidators.Add(app.ApplicationServices.GetRequiredService<ISecurityTokenValidator>());
            app.UseJwtBearerAuthentication(jwtBearerOptions);

            app.UseMvc();
            app.UseDefaultFiles();
            app.UseStaticFiles();
            var configurationData = app.ApplicationServices.GetRequiredService<IOptions<ConfigurationData>>().Value;
            foreach (var directory in configurationData.ListingDictionary)
            {
                app.UseFileServer(new FileServerOptions
                {
                    FileProvider = new PhysicalFileProvider(directory.Value),
                    RequestPath = new PathString("/" + directory.Key),
                    EnableDirectoryBrowsing = true,
                });
                app.UseDirectoryBrowser(new DirectoryBrowserOptions()
                {
                    FileProvider = new PhysicalFileProvider(directory.Value),
                    RequestPath = new PathString("/" + directory.Key),
                    Formatter = new BootstrapFontAwesomeDirectoryFormatter(app.ApplicationServices.GetRequiredService<IFileSystemHelper>())
                });
            }
            app.UseSwagger();
            app.UseSwaggerUI(c =>
            {
                c.SwaggerEndpoint("/swagger/v1/swagger.json", "Israel Hiking API V1");
            });

            app.Run(context =>
            {
                context.Response.StatusCode = 404;
                context.Response.ContentType = "text/html";
                var file = env.WebRootFileProvider.GetFileInfo("/resourceNotFound.html");
                context.Response.ContentLength = file.Length;
                return context.Response.SendFileAsync(file);
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
