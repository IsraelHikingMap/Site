using Microsoft.Owin;
using Owin;
using System.Net.Http.Headers;
using System.Web.Http;
using IsraelHiking.DataAccess;
using System.Web.Http.ExceptionHandling;
using IsraelHiking.API.Gpx;
using Microsoft.Practices.Unity;
using IsraelHiking.DataAccessInterfaces;
using IsraelHiking.DataAccess.Database;
using IsraelHiking.DataAccess.GPSBabel;
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
            logger.Info("Starting Israel Hiking Server.");
            var config = new HttpConfiguration();
            WebApiConfig.Register(config);

            config.Formatters.JsonFormatter.SupportedMediaTypes.Add(new MediaTypeHeaderValue("text/html"));
            config.Formatters.JsonFormatter.SerializerSettings.ReferenceLoopHandling = Newtonsoft.Json.ReferenceLoopHandling.Ignore;
            config.Formatters.JsonFormatter.SerializerSettings.PreserveReferencesHandling = Newtonsoft.Json.PreserveReferencesHandling.None;
            config.Services.Add(typeof(IExceptionLogger), logger);
            config.DependencyResolver = new UnityResolver(RegisterUnityTypes(logger));

            app.UseWebApi(config);
            logger.Info("Israel Hiking Server is up and running.");
        }

        private UnityContainer RegisterUnityTypes(ILogger logger)
        {
            var container = new UnityContainer();
            container.RegisterType<ILogger, Logger>();
            container.RegisterType<IProcessHelper, ProcessHelper>();
            container.RegisterType<IFileSystemHelper, FileSystemHelper>();
            container.RegisterType<IGpxGeoJsonConverter, GpxGeoJsonConverter>();
            container.RegisterType<IGpxDataContainerConverter, GpxDataContainerConverter>();
            container.RegisterType<IRemoteFileFetcherGateway, RemoteFileFetcherGateway>();
            container.RegisterType<IIsraelHikingDbContext, IsraelHikingDbContext>();
            container.RegisterType<IIsraelHikingRepository, IsraelHikingRepository>();
            container.RegisterType<IElevationDataStorage, ElevationDataStorage>(new ContainerControlledLifetimeManager());
            container.RegisterType<IGpsBabelGateway, GpsBabelGateway>();
            container.RegisterType<IRoutingGateway, RoutingGateway>();
            container.RegisterType<ICoordinatesConverter, CoordinatesConverter>();
            container.RegisterType<IDataContainerConverter, DataContainerConverter>();

            logger.Info("Initializing Elevation data and Graph Hopper Service");
            container.Resolve<IElevationDataStorage>().Initialize().ContinueWith(task => logger.Info("Finished loading elevation data from files."));
            return container;
        }
    }
}