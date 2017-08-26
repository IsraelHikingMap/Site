using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Text;
using System.Threading.Tasks;
using GeoAPI.Geometries;
using IsraelHiking.Common;
using IsraelHiking.DataAccessInterfaces;
using Microsoft.Extensions.Logging;
using NetTopologySuite.Features;
using NetTopologySuite.Geometries;

namespace IsraelHiking.API.Services.Poi
{
    public class NakebAdapter : BasePoiAdapter, IPointsOfInterestAdapter
    {
        /// <inheritdoc />
        public string Source => Sources.NAKEB;

        private readonly INakebGateway _nakebGateway;
        private readonly ILogger _logger;

        public NakebAdapter(INakebGateway nakebGateway,
            IElevationDataStorage elevationDataStorage,
            ILogger logger) : base(elevationDataStorage)
        {
            _nakebGateway = nakebGateway;
            _logger = logger;
        }

        /// <inheritdoc />
        public Task<PointOfInterest[]> GetPointsOfInterest(Coordinate northEast, Coordinate southWest, string[] categories, string language)
        {
            // points are stored in elastic search
            return Task.Run(() => new PointOfInterest[0]);
        }

        /// <inheritdoc />
        public async Task<PointOfInterestExtended> GetPointOfInterestById(string id, string language)
        {
            var featureCollection = await _nakebGateway.GetById(int.Parse(id));
            var mainFeature = featureCollection.Features.FirstOrDefault(f => f.Geometry is LineString);
            var poiItem = await ConvertToPoiItem<PointOfInterestExtended>(mainFeature, "he");
            AddExtendedData(poiItem, mainFeature, language);
            poiItem.FeatureCollection = featureCollection;
            poiItem.IsEditable = false;
            return poiItem;
        }

        /// <inheritdoc />
        public Task UpdatePointOfInterest(PointOfInterestExtended pointOfInterest, TokenAndSecret tokenAndSecret, string language)
        {
            throw new Exception("Nakeb does not support updating.");
        }

        /// <inheritdoc />
        public async Task<List<Feature>> GetPointsForIndexing(Stream memoryStream)
        {
            _logger.LogInformation("Getting data from Nakeb.");
            var features = await _nakebGateway.GetAll();
            _logger.LogInformation($"Got {features.Count} routes from Nakeb.");
            return features;
        }
    }
}
