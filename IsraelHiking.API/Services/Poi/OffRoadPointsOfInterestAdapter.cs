using System;
using System.Collections.Generic;
using System.IO;
using System.Text;
using System.Threading.Tasks;
using GeoAPI.Geometries;
using IsraelHiking.Common;
using IsraelHiking.DataAccess;
using IsraelHiking.DataAccessInterfaces;
using Microsoft.Extensions.Logging;
using NetTopologySuite.Features;

namespace IsraelHiking.API.Services.Poi
{
    public class OffRoadPointsOfInterestAdapter: BasePointsOfInterestAdapter, IPointsOfInterestAdapter
    {
        private readonly IOffRoadGateway _offRoadGateway;
        private readonly ILogger _logger;
        /// <inheritdoc />
        public OffRoadPointsOfInterestAdapter(IElevationDataStorage elevationDataStorage, 
            IElasticSearchGateway elasticSearchGateway, 
            IOffRoadGateway offRoadGateway,
            ILogger logger) : 
            base(elevationDataStorage, elasticSearchGateway)
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
        public Task<PointOfInterestExtended> GetPointOfInterestById(string id, string language)
        {
            // Need to implement
            throw new NotImplementedException();
        }

        /// <inheritdoc />
        public Task<PointOfInterestExtended> AddPointOfInterest(PointOfInterestExtended pointOfInterest, TokenAndSecret tokenAndSecret, string language)
        {
            // Not supported
            throw new NotImplementedException();
        }

        /// <inheritdoc />
        public Task<PointOfInterestExtended> UpdatePointOfInterest(PointOfInterestExtended pointOfInterest, TokenAndSecret tokenAndSecret, string language)
        {
            // Not supported
            throw new NotImplementedException();
        }

        /// <inheritdoc />
        public async Task<List<Feature>> GetPointsForIndexing(Stream memoryStream)
        {
            _logger.LogInformation("Getting data from Nakeb.");
            var features = await _offRoadGateway.GetAll();
            _logger.LogInformation($"Got {features.Count} routes from Nakeb.");
            return features;

        }
    }
}
