using GeoAPI.CoordinateSystems.Transformations;
using GeoAPI.Geometries;
using IsraelHiking.API.Controllers;
using IsraelHiking.API.Converters;
using IsraelHiking.API.Executors;
using IsraelHiking.API.Services;
using IsraelHiking.API.Services.Osm;
using IsraelHiking.Common;
using IsraelHiking.DataAccess;
using IsraelHiking.DataAccess.Database;
using IsraelHiking.DataAccess.ElasticSearch;
using IsraelHiking.DataAccess.GPSBabel;
using IsraelHiking.DataAccess.GraphHopper;
using IsraelHiking.DataAccess.OpenStreetMap;
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
using Microsoft.IdentityModel.Tokens;
using NetTopologySuite.Geometries;
using Swashbuckle.AspNetCore.Swagger;
using System.IO;

namespace IsraelHiking.Web
{
    public class Startup
    {
        // This method gets called by the runtime. Use this method to add services to the container.
        // For more information on how to configure your application, visit https://go.microsoft.com/fwlink/?LinkID=398940
        public void ConfigureServices(IServiceCollection services)
        {
            services.AddMvc();
            services.AddOptions();
            var config = new ConfigurationBuilder()
                .AddJsonFile("configurations.json", optional: true, reloadOnChange: true)
                .Build();
            services.Configure<ConfigurationData>(config);
            services.AddSingleton((serviceProvider) => serviceProvider.GetRequiredService<ILoggerFactory>().CreateLogger("IHM"));
            services.AddTransient<IProcessHelper, ProcessHelper>();
            services.AddTransient<IFileSystemHelper, FileSystemHelper>();
            services.AddTransient<IFileProvider, PhysicalFileProvider>((serviceProvider) => new PhysicalFileProvider(Directory.GetCurrentDirectory()));
            services.AddTransient<IHttpGatewayFactory, HttpGatewayFactory>();
            services.AddTransient<IRemoteFileSizeFetcherGateway, RemoteFileFetcherGateway>();
            services.AddTransient<IIsraelHikingRepository, IsraelHikingRepository>();
            services.AddTransient<IGpsBabelGateway, GpsBabelGateway>();
            services.AddTransient<IGraphHopperGateway, GraphHopperGateway>();
            services.AddSingleton<IElasticSearchGateway, ElasticSearchGateway>();
            services.AddSingleton<IElevationDataStorage, ElevationDataStorage>();
            services.AddTransient<IOsmRepository, OsmRepository>();
            services.AddTransient<IOsmGateway, OsmGateway>();

            services.AddTransient<IGpxGeoJsonConverter, GpxGeoJsonConverter>();
            services.AddTransient<IGpxDataContainerConverter, GpxDataContainerConverter>();
            services.AddTransient<IOsmGeoJsonConverter, OsmGeoJsonConverter>();
            services.AddTransient<IMathTransform, ItmWgs84MathTransfrom>((serviceProvider) => new ItmWgs84MathTransfrom(false));
            services.AddTransient<IDataContainerConverterService, DataContainerConverterService>();
            services.AddTransient<IRouteDataSplitterService, RouteDataSplitterService>();
            services.AddTransient<IGpxProlongerExecutor, GpxProlongerExecutor>();
            services.AddTransient<IGpxLoopsSplitterExecutor, GpxLoopsSplitterExecutor>();
            services.AddTransient<IAddibleGpxLinesFinderService, AddibleGpxLinesFinderService>();
            services.AddTransient<IOsmGeoJsonPreprocessorExecutor, OsmGeoJsonPreprocessorExecutor>();
            services.AddTransient<IOsmDataService, OsmDataService>();
            services.AddSingleton<LruCache<string, TokenAndSecret>>();
            services.AddSingleton<IGeometryFactory, GeometryFactory>((serviceProvider) => new GeometryFactory(new PrecisionModel(100000000)));
            services.AddTransient<IImageCreationService, ImageCreationService>();
            services.AddTransient<IOsmLineAdderService, OsmLineAdderService>();
            services.AddTransient<IGeoJsonFeatureHelper, GeoJsonFeatureHelper>();
            services.AddSingleton<ISecurityTokenValidator, OsmAccessTokenValidator>();
            services.AddSwaggerGen(c =>
            {
                c.SwaggerDoc("v1", new Info { Title = "Israel Hiking API", Version = "v1" });
            });
            services.AddEntityFrameworkSqlite().AddDbContext<IsraelHikingDbContext>();
            services.AddDirectoryBrowser();
            //services.AddAuthentication();
        }

        // This method gets called by the runtime. Use this method to configure the HTTP request pipeline.
        public void Configure(IApplicationBuilder app, IHostingEnvironment env, ILoggerFactory loggerFactory)
        {
            loggerFactory.AddConsole();
            loggerFactory.AddFile("Logs/IsraelHiking-{Date}.log");

            var rewriteOptions = new RewriteOptions()
                .AddRewrite(".*escaped_fragment_=/%3Fs=(.*)", "api/opengraph/$1", skipRemainingRules: false);
            //.AddRewrite("escaped_fragment_=%2F%3Fs%3D(.*)", "api/opengraph/$1", skipRemainingRules: false);

            if (env.IsDevelopment())
            {
                app.UseDeveloperExceptionPage();
            } else
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
            
        }
    }
}
