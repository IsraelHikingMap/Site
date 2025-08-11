using System.Diagnostics.CodeAnalysis;
using IsraelHiking.API.Converters;
using IsraelHiking.API.Converters.ConverterFlows;
using IsraelHiking.API.Executors;
using IsraelHiking.API.Services;
using IsraelHiking.API.Services.Osm;
using IsraelHiking.API.Services.Poi;
using Microsoft.Extensions.DependencyInjection;

namespace IsraelHiking.API;

/// <summary>
/// This class registers all the services related to the API layer
/// </summary>
[ExcludeFromCodeCoverage]
public static class RegisterApi
{
    /// <summary>
    /// Registers all the API layer services
    /// </summary>
    /// <param name="services">The <see cref="IServiceCollection"/> to use for registration</param>
    /// <returns></returns>
    public static void AddIHMApi(this IServiceCollection services)
    {
        services.AddTransient<IGpxGeoJsonConverter, GpxGeoJsonConverter>();
        services.AddTransient<IGpxDataContainerConverter, GpxDataContainerConverter>();
        services.AddTransient<IOsmGeoJsonConverter, OsmGeoJsonConverter>();
        services.AddTransient<IDataContainerConverterService, DataContainerConverterService>();
        services.AddTransient<IRouteDataSplitterService, RouteDataSplitterService>();
        services.AddTransient<IGpxProlongerExecutor, GpxProlongerExecutor>();
        services.AddTransient<IGpxLoopsSplitterExecutor, GpxLoopsSplitterExecutor>();
        services.AddTransient<IAddibleGpxLinesFinderService, AddibleGpxLinesFinderService>();
        services.AddTransient<IOsmGeoJsonPreprocessorExecutor, OsmGeoJsonPreprocessorExecutor>();
        services.AddTransient<IFeaturesMergeExecutor, FeaturesMergeExecutor>();
        services.AddTransient<IOsmLineAdderService, OsmLineAdderService>();
        services.AddTransient<ITagsHelper, TagsHelper>();
        services.AddTransient<IPointsOfInterestProvider, PointsOfInterestProvider>();
        services.AddTransient<IPointsOfInterestFilesCreatorExecutor, PointsOfInterestFilesCreatorExecutor>();
        services.AddTransient<IOfflineFilesService, OfflineFilesService>();
        services.AddTransient<IImagesUrlsStorageExecutor, ImagesUrlsStorageExecutor>();
        services.AddTransient<IExternalSourceUpdaterExecutor, ExternalSourceUpdaterExecutor>();
        services.AddTransient<ISimplePointAdderExecutor, SimplePointAdderExecutor>();
        services.AddTransient<IUnauthorizedImageUrlsRemover, UnauthorizedImageUrlsRemover>();

        // registration here is what determines the order of which to merge points:
        services.AddTransient<IPointsOfInterestAdapter, NakebPointsOfInterestAdapter>();
        services.AddTransient<IPointsOfInterestAdapter, INaturePointsOfInterestAdapter>();
        services.AddTransient<IPointsOfInterestAdapter, WikidataPointsOfInterestAdapter>();
        services.AddTransient<CsvPointsOfInterestAdapter>();
        services.AddSingleton<IPointsOfInterestAdapterFactory, PointsOfInterestAdapterFactory>();
        // last one is the least important

        services.AddSingleton<IItmWgs84MathTransformFactory, ItmWgs84MathTransformFactory>();
        services.AddTransient<IDatabasesUpdaterService, DatabasesUpdaterService>();
        services.AddTransient<IBase64ImageStringToFileConverter, Base64ImageStringToFileConverter>();
        services.AddTransient<IConverterFlowItem, GeoJsonGpxConverterFlow>();
        services.AddTransient<IConverterFlowItem, GpxGeoJsonConverterFlow>();
        services.AddTransient<IConverterFlowItem, GpxToSingleTrackGpxConverterFlow>();
        services.AddTransient<IConverterFlowItem, GpxToRouteGpxConverterFlow>();
        services.AddTransient<IConverterFlowItem, KmzToKmlConverterFlow>();
        services.AddTransient<IConverterFlowItem, GpxGzToGpxConverterFlow>();
        services.AddTransient<IConverterFlowItem, GpxVersion1ToGpxVersion11ConverterFlow>();
        services.AddTransient<IConverterFlowItem, GpxBz2ToGpxConverterFlow>();
    }
}