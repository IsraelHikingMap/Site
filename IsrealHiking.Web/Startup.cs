using System;
using System.Configuration;
using Microsoft.Owin;
using Owin;
using System.Net.Http.Headers;
using System.Web.Http;
using IsraelHiking.DataAccess;
using System.Web.Http.ExceptionHandling;
using Microsoft.Practices.Unity;
using IsraelHiking.DataAccessInterfaces;
using IsraelHiking.DataAccess.Database;
using IsraelHiking.DataAccess.GraphHopper;
using IsraelTransverseMercator;
using Microsoft.Owin.FileSystems;
using Microsoft.Owin.StaticFiles;

[assembly: OwinStartup(typeof(IsraelHiking.Web.Startup))]
[assembly: log4net.Config.XmlConfigurator(Watch = true)]

namespace IsraelHiking.Web
{
    public class Startup
    {
        private const string DIRECTORY_LISTING_KEY = "directoryListing";

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
            SetupFileServer(app, logger);
            logger.Info("Israel Hiking Server is up and running.");
        }

        private void SetupFileServer(IAppBuilder app, ILogger logger)
        {
            var physicalPath = ConfigurationManager.AppSettings[DIRECTORY_LISTING_KEY];
            logger.Info("Seting-up file server for folder " + physicalPath);
            var physicalFileSystem = new PhysicalFileSystem(physicalPath);
            var options = new FileServerOptions
            {
                EnableDefaultFiles = true,
                EnableDirectoryBrowsing = true,
                FileSystem = physicalFileSystem,
                RequestPath = new PathString("/files")
            };
            options.StaticFileOptions.FileSystem = physicalFileSystem;
            options.StaticFileOptions.ServeUnknownFileTypes = true;

            app.UseFileServer(options);
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
            
            logger.Info("Initializing Elevation data and Graph Hopper Service");
            container.Resolve<IElevationDataStorage>().Initialize().ContinueWith(task => logger.Info("Finished loading elevation data from files."));
            return container;
        }
    }
}