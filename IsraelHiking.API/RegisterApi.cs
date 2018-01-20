using IsraelHiking.API.Converters;
using IsraelHiking.API.Converters.ConverterFlows;
using IsraelHiking.API.Executors;
using IsraelHiking.API.Services;
using IsraelHiking.API.Services.Osm;
using IsraelHiking.API.Services.Poi;
using IsraelHiking.Common;
using Microsoft.Extensions.DependencyInjection;

namespace IsraelHiking.API
{
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
        public static IServiceCollection AddIHMApi(this IServiceCollection services)
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
            services.AddTransient<IOsmLatestFileFetcher, OsmLatestFileFetcher>();
            services.AddSingleton<LruCache<string, TokenAndSecret>>();
            services.AddTransient<IImageCreationService, ImageCreationService>();
            services.AddTransient<IOsmLineAdderService, OsmLineAdderService>();
            services.AddTransient<ITagsHelper, TagsHelper>();
            services.AddTransient<IPointsOfInterestAdapter, OsmPointsOfInterestAdapter>();
            services.AddTransient<IPointsOfInterestAdapter, NakebPointsOfInterestAdapter>();
            services.AddTransient<IPointsOfInterestAdapter, OffRoadPointsOfInterestAdapter>();
            services.AddTransient<IPointsOfInterestAdapter, WikipediaPointsOfInterestAdapter>();
            services.AddSingleton<IItmWgs84MathTransfromFactory, ItmWgs84MathTransfromFactory>();
            services.AddTransient<IOsmElasticSearchUpdaterService, OsmElasticSearchUpdaterService>();
            services.AddTransient<IConverterFlowItem, GeoJsonGpxConverterFlow>();
            services.AddTransient<IConverterFlowItem, GpxGeoJsonConverterFlow>();
            services.AddTransient<IConverterFlowItem, GpxToSingleTrackGpxConverterFlow>();
            services.AddTransient<IConverterFlowItem, GpxToRouteGpxConverterFlow>();
            services.AddTransient<IConverterFlowItem, KmzToKmlConverterFlow>();
            services.AddTransient<IConverterFlowItem, GpxGzToGpxConverterFlow>();
            services.AddTransient<IConverterFlowItem, GpxVersion1ToGpxVersion11ConverterFlow>();
            services.AddTransient<IConverterFlowItem, GpxBz2ToGpxConverterFlow>();
            services.AddTransient<IConverterFlowItem, JpgToGpxConverterFlow>();
            return services;
        }
    }
}
