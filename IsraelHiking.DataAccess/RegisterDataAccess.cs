using IsraelHiking.DataAccess.OpenStreetMap;
using IsraelHiking.DataAccessInterfaces;
using IsraelHiking.DataAccessInterfaces.Repositories;
using Microsoft.Extensions.DependencyInjection;

namespace IsraelHiking.DataAccess
{
    public static class RegisterDataAccess
    {
        public static IServiceCollection AddIHMDataAccess(this IServiceCollection services)
        {
            services.AddTransient<IProcessHelper, ProcessHelper>();
            services.AddTransient<IFileSystemHelper, FileSystemHelper>();
            services.AddTransient<IRemoteFileSizeFetcherGateway, RemoteFileFetcherGateway>();
            services.AddTransient<IRemoteFileFetcherGateway, RemoteFileFetcherGateway>();
            services.AddTransient<IGpsBabelGateway, GpsBabelGateway>();
            services.AddTransient<IGraphHopperGateway, GraphHopperGateway>();
            services.AddSingleton<IElasticSearchGateway, ElasticSearchGateway>();
            services.AddSingleton<IRepository>(x => x.GetService<IElasticSearchGateway>());
            services.AddSingleton<IImagesRepository>(x => x.GetService<IElasticSearchGateway>());
            services.AddSingleton<IExternalSourcesRepository>(x => x.GetService<IElasticSearchGateway>());
            services.AddSingleton<IElevationDataStorage, ElevationDataStorage>();
            services.AddTransient<IOsmRepository, OsmRepository>();
            services.AddTransient<INakebGateway, NakebGateway>();
            services.AddSingleton<IWikipediaGateway, WikipediaGateway>();
            services.AddSingleton<IWikimediaCommonGateway, WikimediaCommonGateway>();
            services.AddTransient<IImgurGateway, ImgurGateway>();
            services.AddSingleton<IINatureGateway, INatureGateway>();
            services.AddTransient<IReceiptValidationGateway, ReceiptValidationGateway>();
            return services;
        }
    }
}
