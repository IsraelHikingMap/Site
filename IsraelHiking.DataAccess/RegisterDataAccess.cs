using IsraelHiking.DataAccess.ElasticSearch;
using IsraelHiking.DataAccessInterfaces;
using IsraelHiking.DataAccessInterfaces.Repositories;
using Microsoft.Extensions.DependencyInjection;

namespace IsraelHiking.DataAccess;

public static class RegisterDataAccess
{
    public static IServiceCollection AddIHMDataAccess(this IServiceCollection services)
    {
        services.AddTransient<IFileSystemHelper, FileSystemHelper>();
        services.AddTransient<IRemoteFileSizeFetcherGateway, RemoteFileFetcherGateway>();
        services.AddTransient<IRemoteFileFetcherGateway, RemoteFileFetcherGateway>();
        services.AddTransient<IGpsBabelGateway, GpsBabelGateway>();
        services.AddTransient<IRoutingGateway, ValhallaGateway>();
        services.AddTransient<IImageCreationGateway, ImageCreationGateway>();
        services.AddSingleton<ElasticSearchGateway, ElasticSearchGateway>();
        services.AddSingleton<ISearchRepository>(x => x.GetService<ElasticSearchGateway>());
        services.AddSingleton<IImagesRepository>(x => x.GetService<ElasticSearchGateway>());
        services.AddSingleton<IWikimediaCommonGateway, WikimediaCommonGateway>();
        services.AddTransient<IReceiptValidationGateway, ReceiptValidationGateway>();
        services.AddTransient<IOverpassTurboGateway, OverpassTurboGateway>();
        services.AddTransient<IWikidataGateway, WikidataGateway>();
        services.AddTransient<IShareUrlGateway, ShareUrlGateway>();
        // Initializables
        services.AddSingleton<IInitializable>(x => x.GetService<ElasticSearchGateway>());

        return services;
    }
}