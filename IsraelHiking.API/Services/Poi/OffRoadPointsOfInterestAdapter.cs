using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Threading.Tasks;
using GeoAPI.Geometries;
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
    public class OffRoadPointsOfInterestAdapter: BasePointsOfInterestAdapter, IPointsOfInterestAdapter
    {
        private readonly IOffRoadGateway _offRoadGateway;
        private readonly ILogger _logger;
        /// <inheritdoc />
        public OffRoadPointsOfInterestAdapter(IElevationDataStorage elevationDataStorage, 
            IElasticSearchGateway elasticSearchGateway, 
            IOffRoadGateway offRoadGateway,
            IDataContainerConverterService dataContainerConverterService,
            ILogger logger) : 
            base(elevationDataStorage, elasticSearchGateway, dataContainerConverterService)
        {
            _offRoadGateway = offRoadGateway;
            _logger = logger;
        }

        /// <inheritdoc />
        public string Source => Sources.OFFROAD;

        /// <inheritdoc />
        public Task<PointOfInterest[]> GetPointsOfInterest(Coordinate northEast, Coordinate southWest, string[] categories, string language)
        {
            // points are stored in elastic search
            return Task.Run(() => new PointOfInterest[0]);
        }

        /// <inheritdoc />
        public async Task<PointOfInterestExtended> GetPointOfInterestById(string id, string language, string type = "")
        {
            var featureCollection = await _offRoadGateway.GetById(id);
            var mainFeature = featureCollection.Features.FirstOrDefault(f => f.Geometry is LineString);
            var poiItem = await ConvertToPoiItem<PointOfInterestExtended>(mainFeature, language);
            await AddExtendedData(poiItem, mainFeature, language);
            poiItem.IsRoute = true;
            return poiItem;
        }

        /// <inheritdoc />
        public Task<PointOfInterestExtended> AddPointOfInterest(PointOfInterestExtended pointOfInterest, TokenAndSecret tokenAndSecret, string language)
        {
            throw new Exception("OffRoad does not support adding.");
        }

        /// <inheritdoc />
        public Task<PointOfInterestExtended> UpdatePointOfInterest(PointOfInterestExtended pointOfInterest, TokenAndSecret tokenAndSecret, string language)
        {
            throw new Exception("OffRoad does not support updating.");
        }

        /// <inheritdoc />
        public async Task<List<Feature>> GetPointsForIndexing(Stream memoryStream)
        {
            _logger.LogInformation("Getting data from Off-road.");
            var features = await _offRoadGateway.GetAll();
            _logger.LogInformation($"Got {features.Count} routes from Off-road.");
            return features;
        }
    }
}
