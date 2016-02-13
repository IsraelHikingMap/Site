using Microsoft.Owin;
using Owin;
using System.Net.Http.Headers;
using System.Web.Http;
using IsraelHiking.DataAccess;
using System.Web.Http.ExceptionHandling;
using Microsoft.Practices.Unity;
using IsraelHiking.DataAccessInterfaces;
using IsraelHiking.DataAccess.Database;
using IsraelTransverseMercator;

[assembly: OwinStartup(typeof(IsraelHiking.Web.Startup))]
[assembly: log4net.Config.XmlConfigurator(Watch = true)]

namespace IsraelHiking.Web
{
    public class Startup
    {
        public void Configuration(IAppBuilder app)
        {
            ILogger logger = new Logger();
            logger.Debug("Starting Israel Hiking Server.");
            var config = new HttpConfiguration();
            WebApiConfig.Register(config);

            config.Formatters.JsonFormatter.SupportedMediaTypes.Add(new MediaTypeHeaderValue("text/html"));
            config.Formatters.JsonFormatter.SerializerSettings.ReferenceLoopHandling = Newtonsoft.Json.ReferenceLoopHandling.Ignore;
            config.Formatters.JsonFormatter.SerializerSettings.PreserveReferencesHandling = Newtonsoft.Json.PreserveReferencesHandling.None;
            config.Services.Add(typeof(IExceptionLogger), logger);
            config.DependencyResolver = new UnityResolver(RegisterUnityTypes(logger));

            app.UseWebApi(config);
            logger.Debug("Israel Hiking Server is up and running.");
        }

        private UnityContainer RegisterUnityTypes(ILogger logger)
        {
            var container = new UnityContainer();
            container.RegisterType<ILogger, Logger>();
            container.RegisterType<IProcessHelper, ProcessHelper>();
            container.RegisterType<IRemoteFileFetcherGateway, RemoteFileFetcherGateway>();
            container.RegisterType<IIsraelHikingRepository, IsraelHikingRepository>();
            container.RegisterType<IElevationDataStorage, ElevationDataStorage>(new ContainerControlledLifetimeManager());
            container.RegisterType<IGpsBabelGateway, GpsBabelGateway>();
            container.RegisterType<IRoutingGateway, RoutingGateway>();
            container.RegisterType<ICoordinatesConverter, CoordinatesConverter>();
            
            logger.Debug("Initializing Elevation data.");
            container.Resolve<IElevationDataStorage>().Initialize().ContinueWith(task => logger.Debug("Finished loading elevation data from files."));

            return container;
        }
    }
}