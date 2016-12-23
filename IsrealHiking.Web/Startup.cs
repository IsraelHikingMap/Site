using Microsoft.Owin;
using Owin;
using System.Net.Http.Headers;
using System.Web.Http;
using IsraelHiking.DataAccess;
using System.Web.Http.ExceptionHandling;
using IsraelHiking.API;
using IsraelHiking.API.Services;
using IsraelHiking.Common;
using Microsoft.Practices.Unity;
using IsraelHiking.DataAccessInterfaces;
using Microsoft.Owin.Security.OAuth;
using NetTopologySuite.IO.Converters;

[assembly: OwinStartup(typeof(IsraelHiking.Web.Startup))]
[assembly: log4net.Config.XmlConfigurator(Watch = true)]

namespace IsraelHiking.Web
{
    public class Startup
    {
        public void Configuration(IAppBuilder app)
        {
            var logger = new Logger();
            var container = CreateUnityContainer(logger);
            logger.Info("Starting Israel Hiking Server.");
            var config = new HttpConfiguration();
            app.UseOAuthBearerAuthentication(new OAuthBearerAuthenticationOptions
            {
                AccessTokenProvider = new OsmAccessTokenProvider(
                    container.Resolve<IHttpGatewayFactory>(),
                    container.Resolve<LruCache<string, TokenAndSecret>>(),
                    logger)
            });
            WebApiConfig.Register(config, container.Resolve<IConfigurationProvider>());

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

            config.Services.Add(typeof(IExceptionLogger), logger);
            config.DependencyResolver = new UnityResolver(container);
            InitializeServices(container);
            app.UseWebApi(config);
            logger.Info("Israel Hiking Server is up and running.");
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
            logger.Info("Initializing Elevation data and Elastic Search Service");
            container.Resolve<IElasticSearchGateway>().Initialize();
            container.Resolve<IElevationDataStorage>().Initialize().ContinueWith(task => logger.Info("Finished loading elevation data from files."));
        }
    }
}