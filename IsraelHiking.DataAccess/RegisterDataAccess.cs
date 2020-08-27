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
            services.AddSingleton<ElasticSearchGateway, ElasticSearchGateway>();
            services.AddSingleton<IPointsOfInterestRepository>(x => x.GetService<ElasticSearchGateway>());
            services.AddSingleton<IHighwaysRepository>(x => x.GetService<ElasticSearchGateway>());
            services.AddSingleton<IShareUrlsRepository>(x => x.GetService<ElasticSearchGateway>());
            services.AddSingleton<ISearchRepository>(x => x.GetService<ElasticSearchGateway>());
            services.AddSingleton<IUserLayersRepository>(x => x.GetService<ElasticSearchGateway>());
            services.AddSingleton<IImagesRepository>(x => x.GetService<ElasticSearchGateway>());
            services.AddSingleton<IExternalSourcesRepository>(x => x.GetService<ElasticSearchGateway>());
            services.AddSingleton<IElevationDataStorage, ElevationDataStorage>();
            services.AddTransient<IOsmRepository, OsmRepository>();
            services.AddTransient<INakebGateway, NakebGateway>();
            services.AddSingleton<IWikipediaGateway, WikipediaGateway>();
            services.AddSingleton<IWikimediaCommonGateway, WikimediaCommonGateway>();
            services.AddTransient<IImgurGateway, ImgurGateway>();
            services.AddSingleton<IINatureGateway, INatureGateway>();
            services.AddTransient<IReceiptValidationGateway, ReceiptValidationGateway>();
            services.AddTransient<IOverpassTurboGateway, OverpassTurboGateway>();
            // Initializables
            services.AddSingleton<IInitializable>(x => x.GetService<ElasticSearchGateway>());
            services.AddSingleton<IInitializable>(x => x.GetService<IElevationDataStorage>());
            services.AddSingleton<IInitializable>(x => x.GetService<IINatureGateway>());
            services.AddSingleton<IInitializable>(x => x.GetService<IWikimediaCommonGateway>());
            services.AddSingleton<IInitializable>(x => x.GetService<IWikipediaGateway>());

            return services;
        }
    }
}
