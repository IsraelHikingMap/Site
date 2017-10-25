using IsraelHiking.DataAccess.Database;
using IsraelHiking.DataAccess.OpenStreetMap;
using IsraelHiking.DataAccessInterfaces;
using Microsoft.Extensions.DependencyInjection;

namespace IsraelHiking.DataAccess
{
    public static class RegisterDataAccess
    {
        public static IServiceCollection AddIHMDataAccess(this IServiceCollection services)
        {
            services.AddTransient<IProcessHelper, ProcessHelper>();
            services.AddTransient<IFileSystemHelper, FileSystemHelper>();
            services.AddTransient<IHttpGatewayFactory, HttpGatewayFactory>();
            services.AddTransient<IRemoteFileSizeFetcherGateway, RemoteFileFetcherGateway>();
            services.AddTransient<IIsraelHikingRepository, IsraelHikingRepository>();
            services.AddTransient<IGpsBabelGateway, GpsBabelGateway>();
            services.AddTransient<IGraphHopperGateway, GraphHopperGateway>();
            services.AddSingleton<IElasticSearchGateway, ElasticSearchGateway>();
            services.AddSingleton<IElevationDataStorage, ElevationDataStorage>();
            services.AddTransient<IOsmRepository, OsmRepository>();
            services.AddTransient<IOsmGateway, OsmGateway>();
            services.AddTransient<INakebGateway, NakebGateway>();
            services.AddTransient<IOffRoadGateway, OffRoadGateway>();
            services.AddSingleton<IWikipediaGateway, WikipediaGateway>();
            return services;
        }
    }
}
