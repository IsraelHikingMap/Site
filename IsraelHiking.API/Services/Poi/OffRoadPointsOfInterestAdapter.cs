using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Threading.Tasks;
using IsraelHiking.API.Executors;
using IsraelHiking.Common;
using IsraelHiking.DataAccessInterfaces;
using Microsoft.Extensions.Logging;
using NetTopologySuite.Features;
using NetTopologySuite.Geometries;

namespace IsraelHiking.API.Services.Poi
{
    /// <summary>
    /// Adapts from off-road interface to business logic point of interest
    /// </summary>
    public class OffRoadPointsOfInterestAdapter: BasePointsOfInterestAdapter
    {
        private readonly IOffRoadGateway _offRoadGateway;
        private readonly ILogger _logger;
        /// <inheritdoc />
        public OffRoadPointsOfInterestAdapter(IElevationDataStorage elevationDataStorage, 
            IElasticSearchGateway elasticSearchGateway, 
            IOffRoadGateway offRoadGateway,
            IDataContainerConverterService dataContainerConverterService,
            IItmWgs84MathTransfromFactory itmWgs84MathTransfromFactory,
            ILogger logger) : 
            base(elevationDataStorage, elasticSearchGateway, dataContainerConverterService, itmWgs84MathTransfromFactory)
        {
            _offRoadGateway = offRoadGateway;
            _logger = logger;
        }

        /// <inheritdoc />
        public override string Source => Sources.OFFROAD;

        /// <inheritdoc />
        public override async Task<PointOfInterestExtended> GetPointOfInterestById(string id, string language)
        {
            var featureCollection = await _offRoadGateway.GetById(id);
            var mainFeature = featureCollection.Features.FirstOrDefault(f => f.Geometry is LineString);
            var poiItem = await ConvertToPoiItem<PointOfInterestExtended>(mainFeature, language);
            await AddExtendedData(poiItem, mainFeature, language);
            poiItem.IsRoute = true;
            return poiItem;
        }

        /// <inheritdoc />
        public override async Task<List<Feature>> GetPointsForIndexing(Stream memoryStream)
        {
            _logger.LogInformation("Getting data from Off-road.");
            var features = await _offRoadGateway.GetAll();
            _logger.LogInformation($"Got {features.Count} routes from Off-road.");
            return features;
        }
    }
}
