using System.Collections.Generic;
using System.Threading.Tasks;
using IsraelHiking.API.Executors;
using IsraelHiking.Common;
using IsraelHiking.Common.Poi;
using IsraelHiking.DataAccessInterfaces;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using NetTopologySuite.Features;

namespace IsraelHiking.API.Services.Poi
{
    /// <summary>
    /// Adapts from nakeb interface to business logic point of interest
    /// </summary>
    public class NakebPointsOfInterestAdapter : BasePointsOfInterestAdapter
    {
        /// <inheritdoc />
        public override string Source => Sources.NAKEB;

        private readonly INakebGateway _nakebGateway;

        /// <summary>
        /// Constructor
        /// </summary>
        /// <param name="nakebGateway"></param>
        /// <param name="elevationDataStorage"></param>
        /// <param name="elasticSearchGateway"></param>
        /// <param name="dataContainerConverterService"></param>
        /// <param name="itmWgs84MathTransfromFactory"></param>
        /// <param name="options"></param>
        /// <param name="logger"></param>
        public NakebPointsOfInterestAdapter(INakebGateway nakebGateway,
            IElevationDataStorage elevationDataStorage,
            IElasticSearchGateway elasticSearchGateway,
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
            _nakebGateway = nakebGateway;
        }

        /// <inheritdoc />
        public override async Task<PointOfInterestExtended> GetPointOfInterestById(string id, string language)
        {
            var featureCollection = await GetFromCacheIfExists(id);
            if (featureCollection == null)
            {
                featureCollection = await _nakebGateway.GetById(id);
                SetToCache(featureCollection);
            }
            var poiItem = await ConvertToPoiExtended(featureCollection, language);
            poiItem.IsRoute = true;
            return poiItem;
        }

        /// <inheritdoc />
        public override async Task<List<Feature>> GetPointsForIndexing()
        {
            _logger.LogInformation("Getting data from Nakeb.");
            var features = await _nakebGateway.GetAll();
            _logger.LogInformation($"Got {features.Count} routes from Nakeb.");
            return features;
        }
    }
}
