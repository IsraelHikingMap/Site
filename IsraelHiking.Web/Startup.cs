﻿using System;
using Microsoft.Owin;
using Owin;
using System.Net.Http.Headers;
using System.Web.Http;
using IsraelHiking.DataAccess;
using System.Web.Http.ExceptionHandling;
using System.Web.Http.Validation;
using IsraelHiking.API;
using IsraelHiking.API.Controllers;
using IsraelHiking.API.Services;
using IsraelHiking.API.Swagger;
using IsraelHiking.Common;
using Microsoft.Practices.Unity;
using IsraelHiking.DataAccessInterfaces;
using Microsoft.Owin.FileSystems;
using Microsoft.Owin.Security.OAuth;
using Microsoft.Owin.StaticFiles;
using NetTopologySuite.Features;
using NetTopologySuite.IO.Converters;
using Swashbuckle.Application;

[assembly: OwinStartup(typeof(IsraelHiking.Web.Startup))]
[assembly: log4net.Config.XmlConfigurator(Watch = true)]

namespace IsraelHiking.Web
{
    public class CustomBodyModelValidator : DefaultBodyModelValidator
    {
        public override bool ShouldValidateType(Type type)
        {
            return type != typeof(Feature) && type != typeof(FeatureCollection) && base.ShouldValidateType(type);
        }
    }

    public class Startup
    {
        public void Configuration(IAppBuilder app)
        {
            var logger = new Logger();
            var container = CreateUnityContainer(logger);
            logger.LogInformation("Starting Israel Hiking Server.");
            var config = new HttpConfiguration();
            app.UseOAuthBearerAuthentication(new OAuthBearerAuthenticationOptions
            {
                AccessTokenProvider = new OsmAccessTokenProvider(
                    container.Resolve<IHttpGatewayFactory>(),
                    container.Resolve<LruCache<string, TokenAndSecret>>(),
                    logger)
            });
            WebApiConfig.Register(config);

            config.Formatters.JsonFormatter.SupportedMediaTypes.Add(new MediaTypeHeaderValue("text/html"));
            config.Formatters.JsonFormatter.SerializerSettings.ReferenceLoopHandling = Newtonsoft.Json.ReferenceLoopHandling.Ignore;
            config.Formatters.JsonFormatter.SerializerSettings.PreserveReferencesHandling = Newtonsoft.Json.PreserveReferencesHandling.None;
            config.Formatters.JsonFormatter.SerializerSettings.Converters.Add(new CoordinateConverter());
            config.Formatters.JsonFormatter.SerializerSettings.Converters.Add(new GeometryConverter());
            config.Formatters.JsonFormatter.SerializerSettings.Converters.Add(new FeatureCollectionConverter());
            config.Formatters.JsonFormatter.SerializerSettings.Converters.Add(new FeatureConverter());
            config.Formatters.JsonFormatter.SerializerSettings.Converters.Add(new AttributesTableConverter());
            config.Formatters.JsonFormatter.SerializerSettings.Converters.Add(new ICRSObjectConverter());
            config.Formatters.JsonFormatter.SerializerSettings.Converters.Add(new GeometryArrayConverter());
            config.Formatters.JsonFormatter.SerializerSettings.Converters.Add(new EnvelopeConverter());
            config.EnableSwagger(c =>
            {
                c.SingleApiVersion("v1", "IsraelHiking API");
                c.SchemaFilter<FeatureExampleFilter>();
                c.SchemaFilter<FeatureCollectionExampleFilter>();
                c.OperationFilter<AssignOAuthSecurityRequirements>();
                c.IncludeXmlComments($@"{AppDomain.CurrentDomain.BaseDirectory}\bin\israelhiking.api.xml");
            }).EnableSwaggerUi();
            config.Services.Add(typeof(IExceptionLogger), logger);
            config.Services.Replace(typeof(IBodyModelValidator), new CustomBodyModelValidator());
            config.DependencyResolver = new UnityResolver(container);
            InitializeServices(container);
            foreach (var keyValue in container.Resolve<IOptions<ConfigurationData>>().Value.ListingDictionary)
            {
                app.UseDirectoryBrowser(new DirectoryBrowserOptions
                {
                    FileSystem = new PhysicalFileSystem(keyValue.Value),
                    RequestPath = new PathString("/" + keyValue.Key),
                    Formatter = new BootstrapFontAwesomeDirectoryFormatter(container.Resolve<IFileSystemHelper>())
                });
            }
            app.UseWebApi(config);
            logger.LogInformation("Israel Hiking Server is up and running.");
        }

        private IUnityContainer CreateUnityContainer(ILogger logger)
        {
            var container = new UnityContainer();
            UnityRegisterApi.RegisterUnityTypes(container);
            UnityRegisterDataAccess.RegisterUnityTypes(container, logger);
            return container;
        }

        private void InitializeServices(IUnityContainer container)
        {
            var logger = container.Resolve<ILogger>();
            logger.LogInformation("Initializing Elevation data and Elastic Search Service");
            container.Resolve<IElasticSearchGateway>().Initialize();
            container.Resolve<IElevationDataStorage>().Initialize().ContinueWith(task => logger.LogInformation("Finished loading elevation data from files."));
        }
    }
}