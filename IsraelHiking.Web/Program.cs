using System;
using Microsoft.Extensions.Logging;
using System.IO;
using System.Net.Http;
using System.Reflection;
using System.Text.Json.Serialization;
using System.Threading.Tasks;
using IsraelHiking.API;
using IsraelHiking.API.Services;
using IsraelHiking.API.Services.Middleware;
using IsraelHiking.API.OpenApi;
using IsraelHiking.Common.Configuration;
using IsraelHiking.Common.Extensions;
using IsraelHiking.DataAccess;
using IsraelHiking.DataAccessInterfaces;
using IsraelHiking.Web;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Mvc.ModelBinding;
using Microsoft.AspNetCore.StaticFiles;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Options;
using NeoSmart.Caching.Sqlite;
using Scalar.AspNetCore;
using NetTopologySuite.Features;
using NetTopologySuite.Geometries;
using NLog.Web;
using OsmSharp.IO.API;

NLog.LogManager.Setup().LoadConfigurationFromAppSettings();
var builder = WebApplication.CreateBuilder(args);
SetupServices(builder.Services, builder.Environment.IsDevelopment());
builder.Logging.ClearProviders();
builder.Host.UseNLog();
var application = builder.Build();
SetupApplication(application);
application.Run();


void SetupApplication(WebApplication app)
{
    if (application.Environment.IsDevelopment())
    {
        application.UseDeveloperExceptionPage();
    }
    app.UseResponseCompression();
    app.UseCors(b => b.AllowAnyOrigin().AllowAnyMethod().AllowAnyHeader());
    app.MapControllers();
    app.MapHealthChecks("/api/health");
    // wwwroot
    app.UseDefaultFiles();
    app.UseStaticFiles(new StaticFileOptions
    {
        ContentTypeProvider = new FileExtensionContentTypeProvider
        {
            Mappings = { { ".pbf", "application/x-protobuf" } } // for the fonts files
        }
    });
    app.MapOpenApi();
    app.MapScalarApiReference("/openapi", options => options.AddPreferredSecuritySchemes("Bearer"));
    app.UseMiddleware<CrawlersMiddleware>();
    // This should be the last middleware
    app.UseMiddleware<SpaDefaultHtmlMiddleware>();
    InitializeServices(app.Services);
}

void SetupServices(IServiceCollection services, bool isDevelopment)
{
    services.AddResponseCompression();
    services.AddMemoryCache();
    services.AddLazyCache();
    services.AddHealthChecks();
    services.AddDetection();
    services.AddHttpClient();
    services.AddIHMDataAccess();
    services.AddIHMApi();
    if (Directory.Exists("./Cache") == false)
    {
        Directory.CreateDirectory("./Cache");
    }
    services.AddSqliteCache(options =>
    {
        options.CachePath = "./Cache/cache.sqlite";
    });
    services.AddSingleton<OsmAccessTokenEventsHelper>();
    services.AddSingleton<IClientsFactory>(serviceProvider =>
        new ClientsFactory(serviceProvider.GetRequiredService<ILogger>(),
        serviceProvider.GetRequiredService<IHttpClientFactory>().CreateClient(),
        serviceProvider.GetRequiredService<IOptions<ConfigurationData>>().Value.OsmBaseAddress + "/api/"));
    var geometryFactory = new GeometryFactory(new PrecisionModel(100000000));
    services.AddSingleton<GeometryFactory, GeometryFactory>(_ => geometryFactory);
    services.AddSingleton<IHomePageHelper, HomePageHelper>();
    services.AddControllers(options =>
    {
        options.ModelMetadataDetailsProviders.Add(new SuppressChildValidationMetadataProvider(typeof(Feature)));
    }).AddJsonOptions(options =>
    {
        options.JsonSerializerOptions.Converters.Add(GeoJsonExtensions.GeoJsonWritableFactory);
        options.JsonSerializerOptions.Converters.Add(new DateTimeConverter());
        options.JsonSerializerOptions.NumberHandling = JsonNumberHandling.AllowReadingFromString;
    }).AddApplicationPart(typeof(RegisterApi).Assembly);
    services.AddAuthentication(options =>
    {
        options.DefaultAuthenticateScheme = JwtBearerDefaults.AuthenticationScheme;
        options.DefaultChallengeScheme = JwtBearerDefaults.AuthenticationScheme;
    }).AddJwtBearer(jwtBearerOptions =>
    {
        jwtBearerOptions.Events = new JwtBearerEvents
        {
            OnMessageReceived = context =>
            {
                var tokenService = context.HttpContext.RequestServices.GetService<OsmAccessTokenEventsHelper>();
                return tokenService?.OnMessageReceived(context);
            }
        };
    });
    services.AddCors();
    services.AddOptions();

    var config = new ConfigurationBuilder()
        .AddJsonFile("appsettings.json", optional: false, reloadOnChange: true)
        .AddEnvironmentVariables()
        .Build();
    services.Configure<ConfigurationData>(config);
    var nonPublicConfiguration = new ConfigurationBuilder();
    if (isDevelopment)
    {
        nonPublicConfiguration.AddUserSecrets<NonPublicConfigurationData>();
    }
    else
    {
        nonPublicConfiguration.AddJsonFile("nonPublic.json");
    }
    services.Configure<NonPublicConfigurationData>(nonPublicConfiguration.Build());

    services.AddSingleton(serviceProvider => serviceProvider.GetRequiredService<ILoggerFactory>().CreateLogger("Mapeak"));
    services.AddOpenApi(options =>
    {
        options.AddDocumentTransformer<ApiInfoDocumentTransformer>();
        options.AddSchemaTransformer<FeatureExampleSchemaTransformer>();
        options.AddOperationTransformer<AssignOAuthSecurityOperationTransformer>();
    });
}

void InitializeServices(IServiceProvider serviceProvider)
{
    var logger = serviceProvider.GetRequiredService<ILogger>();
    logger.LogInformation("-----------------------------------------------");
    logger.LogInformation($"Version: {Assembly.GetExecutingAssembly().GetName().Version?.ToString()}");
    logger.LogInformation("Initializing singleton services");
    var initializableServices = serviceProvider.GetServices<IInitializable>();
    foreach (var service in initializableServices)
    {
        var serviceName = service.GetType().ToString();
        service.Initialize().ContinueWith((t) =>
        {
            logger.LogError(t.Exception, $"Failed to initialize service {serviceName}");
        }, TaskContinuationOptions.OnlyOnFaulted);
    }
}