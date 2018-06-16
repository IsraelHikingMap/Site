using System.Collections.Generic;
using System.Threading.Tasks;
using IsraelHiking.API.Executors;
using IsraelHiking.Common;
using IsraelHiking.DataAccessInterfaces;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using NetTopologySuite.Features;

namespace IsraelHiking.API.Services.Poi
{
    /// <summary>
    /// Adapts from off-road interface to business logic point of interest
    /// </summary>
    public class OffRoadPointsOfInterestAdapter: BasePointsOfInterestAdapter
    {
        private readonly IOffRoadGateway _offRoadGateway;

        /// <summary>
        /// Constructor
        /// </summary>
        /// <param name="elevationDataStorage"></param>
        /// <param name="elasticSearchGateway"></param>
        /// <param name="offRoadGateway"></param>
        /// <param name="dataContainerConverterService"></param>
        /// <param name="itmWgs84MathTransfromFactory"></param>
        /// <param name="options"></param>
        /// <param name="logger"></param>
        public OffRoadPointsOfInterestAdapter(IElevationDataStorage elevationDataStorage,
            IElasticSearchGateway elasticSearchGateway,
            IOffRoadGateway offRoadGateway,
            IDataContainerConverterService dataContainerConverterService,
            IItmWgs84MathTransfromFactory itmWgs84MathTransfromFactory,
            IOptions<ConfigurationData> options,
            ILogger logger) :
            base(elevationDataStorage,
                elasticSearchGateway,
                dataContainerConverterService,
                itmWgs84MathTransfromFactory,
                options,
                logger)
        {
            _offRoadGateway = offRoadGateway;
        }

        /// <inheritdoc />
        public override string Source => Sources.OFFROAD;

        /// <inheritdoc />
        public override async Task<PointOfInterestExtended> GetPointOfInterestById(string id, string language)
        {

            var featureCollection = await GetFromCacheIfExists(id);
            if (featureCollection == null)
            {
                featureCollection = await _offRoadGateway.GetById(id);
                SetToCache(featureCollection);
            }  
            var poiItem = await ConvertToPoiExtended(featureCollection, language);
            poiItem.IsRoute = true;
            return poiItem;
        }

        /// <inheritdoc />
        public override async Task<List<Feature>> GetPointsForIndexing()
        {
            _logger.LogInformation("Getting data from Off-road.");
            var features = await _offRoadGateway.GetAll();
            _logger.LogInformation($"Got {features.Count} routes from Off-road.");
            return features;
        }
    }
}
