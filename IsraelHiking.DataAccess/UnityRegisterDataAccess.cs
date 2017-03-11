using IsraelHiking.Common;
using IsraelHiking.DataAccess.Database;
using IsraelHiking.DataAccess.ElasticSearch;
using IsraelHiking.DataAccess.GPSBabel;
using IsraelHiking.DataAccess.GraphHopper;
using IsraelHiking.DataAccess.Osm;
using IsraelHiking.DataAccessInterfaces;
using Microsoft.Practices.Unity;

namespace IsraelHiking.DataAccess
{
    public static class UnityRegisterDataAccess
    {
        public static void RegisterUnityTypes(IUnityContainer container, ILogger logger)
        {
            container.RegisterInstance(logger);
            container.RegisterType<IProcessHelper, ProcessHelper>();
            container.RegisterType<IFileSystemHelper, FileSystemHelper>();
            container.RegisterType<IFileProvider, FileSystemHelper>();
            container.RegisterType<IHttpGatewayFactory, HttpGatewayFactory>();
            container.RegisterType<IRemoteFileSizeFetcherGateway, RemoteFileFetcherGateway>();
            container.RegisterType<IIsraelHikingDbContext, IsraelHikingDbContext>();
            container.RegisterType<IIsraelHikingRepository, IsraelHikingRepository>();
            container.RegisterType<IGpsBabelGateway, GpsBabelGateway>();
            container.RegisterType<IGraphHopperGateway, GraphHopperGateway>();
            container.RegisterType<IElasticSearchGateway, ElasticSearchGateway>(new ContainerControlledLifetimeManager());
            container.RegisterType<IElevationDataStorage, ElevationDataStorage>(new ContainerControlledLifetimeManager());
            container.RegisterType<IGraphHopperHelper, GraphHopperHelper>();
            container.RegisterType<INssmHelper, ElasticSearchHelper>();
            container.RegisterType<IOsmRepository, OsmRepository>();
            container.RegisterType<IOsmGateway, OsmGateway>();
            container.RegisterType<IOverpassGateway, OverpassGateway>();
            container.RegisterType<IOptions<ConfigurationData>, Options>(new ContainerControlledLifetimeManager());
        }
    }
}
