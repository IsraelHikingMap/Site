using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Threading.Tasks;
using GeoAPI.Geometries;
using IsraelHiking.API.Executors;
using IsraelHiking.Common;
using IsraelHiking.DataAccessInterfaces;
using Microsoft.Extensions.Logging;
using NetTopologySuite.Features;

namespace IsraelHiking.API.Services.Poi
{
    /// <summary>
    /// Points of interest adapter for Wikipedia data
    /// </summary>
    public class WikipediaPointsOfInterestAdapter : BasePointsOfInterestAdapter
    {
        private readonly IWikipediaGateway _wikipediaGateway;
        private readonly ILogger _logger;
        private readonly IItmWgs84MathTransfromFactory _itmWgs84MathTransfromFactory;

        /// <summary>
        /// Class constructor
        /// </summary>
        /// <param name="elevationDataStorage"></param>
        /// <param name="elasticSearchGateway"></param>
        /// <param name="dataContainerConverterService"></param>
        /// <param name="wikipediaGateway"></param>
        /// <param name="itmWgs84MathTransfromFactory"></param>
        /// <param name="logger"></param>
        public WikipediaPointsOfInterestAdapter(IElevationDataStorage elevationDataStorage,
            IElasticSearchGateway elasticSearchGateway,
            IDataContainerConverterService dataContainerConverterService,
            IWikipediaGateway wikipediaGateway,
            IItmWgs84MathTransfromFactory itmWgs84MathTransfromFactory,
            ILogger logger) :
            base(elevationDataStorage, elasticSearchGateway, dataContainerConverterService, itmWgs84MathTransfromFactory)
        {
            _wikipediaGateway = wikipediaGateway;
            _logger = logger;
            _itmWgs84MathTransfromFactory = itmWgs84MathTransfromFactory;
        }

        /// <inheritdoc />
        public override string Source => Sources.WIKIPEDIA;

        /// <inheritdoc />
        public override async Task<PointOfInterestExtended> GetPointOfInterestById(string id, string language)
        {
            var feature = await _wikipediaGateway.GetById(id);
            var mainFeature = feature.Features.First();
            if (!mainFeature.Attributes[FeatureAttributes.POI_LANGUAGE].Equals(language))
            {
                return null;
            }
            var poiItem = await ConvertToPoiItem<PointOfInterestExtended>(mainFeature, language);
            await AddExtendedData(poiItem, mainFeature, language);
            poiItem.IsRoute = false;
            return poiItem;
        }

        /// <inheritdoc />
        public override Task<PointOfInterestExtended> AddPointOfInterest(PointOfInterestExtended pointOfInterest, TokenAndSecret tokenAndSecret, string language)
        {
            throw new Exception("Wikipedia does not support adding from this site.");
        }

        /// <inheritdoc />
        public override Task<PointOfInterestExtended> UpdatePointOfInterest(PointOfInterestExtended pointOfInterest, TokenAndSecret tokenAndSecret, string language)
        {
            throw new Exception("Wikipedia does not support updating from this site.");
        }

        /// <inheritdoc />
        public override async Task<List<Feature>> GetPointsForIndexing(Stream memoryStream)
        {
            _logger.LogInformation("Start getting wikipedia pages for indexing");
            var startCoordinate = new Coordinate(34, 29);
            var endCoordinate = new Coordinate(36, 34);
            
            var itmToWgs84 = _itmWgs84MathTransfromFactory.Create();
            var wgs84ToItm = _itmWgs84MathTransfromFactory.CreateInverse();
            double step = 10000 * 2 / Math.Sqrt(2);
            var tasksList = new List<Task<List<Feature>>>();
            foreach (var language in Languages.Array)
            {
                var currentCoordinate = new Coordinate(startCoordinate);
                while (currentCoordinate.X < endCoordinate.X && currentCoordinate.Y < endCoordinate.Y)
                {
                    var itm = wgs84ToItm.Transform(currentCoordinate);
                    itm.X += step;
                    currentCoordinate = itmToWgs84.Transform(itm);
                    if (currentCoordinate.X > endCoordinate.X)
                    {
                        currentCoordinate.X = startCoordinate.X;
                        itm = wgs84ToItm.Transform(currentCoordinate);
                        itm.Y += step;
                        currentCoordinate = itmToWgs84.Transform(itm);
                    }
                    tasksList.Add(_wikipediaGateway.GetByLocation(currentCoordinate, language));
                }
            }
            
            _logger.LogInformation($"Created {tasksList.Count} tasks to fetch wikipedia data.");
            var lists = await Task.WhenAll(tasksList);
            var wikiFeatures = lists.SelectMany(l => l)
                .GroupBy(f => f.Attributes[FeatureAttributes.ID])
                .Select(g => g.First())
                .ToList();
            _logger.LogInformation($"Finished getting wikipedia pages for indexing, got {wikiFeatures.Count} pages.");
            return wikiFeatures;
        }
    }
}
