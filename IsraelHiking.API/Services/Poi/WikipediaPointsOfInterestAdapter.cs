using System;
using System.Collections.Concurrent;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using GeoAPI.Geometries;
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
    /// Points of interest adapter for Wikipedia data
    /// </summary>
    public class WikipediaPointsOfInterestAdapter : BasePointsOfInterestAdapter
    {
        private readonly IWikipediaGateway _wikipediaGateway;
        private readonly IItmWgs84MathTransfromFactory _itmWgs84MathTransfromFactory;

        /// <summary>
        /// Class constructor
        /// </summary>
        /// <param name="elevationDataStorage"></param>
        /// <param name="elasticSearchGateway"></param>
        /// <param name="dataContainerConverterService"></param>
        /// <param name="wikipediaGateway"></param>
        /// <param name="itmWgs84MathTransfromFactory"></param>
        /// <param name="options"></param>
        /// <param name="logger"></param>
        public WikipediaPointsOfInterestAdapter(IElevationDataStorage elevationDataStorage,
            IElasticSearchGateway elasticSearchGateway,
            IDataContainerConverterService dataContainerConverterService,
            IWikipediaGateway wikipediaGateway,
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
            _wikipediaGateway = wikipediaGateway;
            _itmWgs84MathTransfromFactory = itmWgs84MathTransfromFactory;
        }

        /// <inheritdoc />
        public override string Source => Sources.WIKIPEDIA;

        /// <inheritdoc />
        public override async Task<PointOfInterestExtended> GetPointOfInterestById(string id, string language)
        {
            var featureCollection = await GetFromCacheIfExists(id);
            if (featureCollection == null)
            {
                featureCollection = await _wikipediaGateway.GetById(id);
                SetToCache(featureCollection);
            }
            
            var mainFeature = featureCollection.Features.First();
            if (!mainFeature.Attributes[FeatureAttributes.POI_LANGUAGE].Equals(language))
            {
                return null;
            }
            var poiItem = await ConvertToPoiExtended(featureCollection, language);
            poiItem.IsRoute = false;
            return poiItem;
        }

        /// <inheritdoc />
        public override async Task<List<Feature>> GetPointsForIndexing()
        {
            _logger.LogInformation("Start getting Wikipedia pages for indexing.");
            var startCoordinate = new Coordinate(34, 29);
            var endCoordinate = new Coordinate(36, 34);
            
            var itmToWgs84 = _itmWgs84MathTransfromFactory.Create();
            var wgs84ToItm = _itmWgs84MathTransfromFactory.CreateInverse();
            double step = 10000 * Math.Sqrt(2);
            var coordinatesList = new List<Coordinate>();
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
                coordinatesList.Add(currentCoordinate);
            }
            
            _logger.LogInformation($"Created {coordinatesList.Count} coordinates centers to fetch Wikipedia data.");
            var lists = new ConcurrentBag<List<Feature>>();
            await Task.Run(() =>
            {
                Parallel.ForEach(coordinatesList, new ParallelOptions { MaxDegreeOfParallelism = 10 }, (coordinate) =>
                {
                    foreach (var language in Languages.Array)
                    {
                        lists.Add(_wikipediaGateway.GetByLocation(coordinate, language).Result);
                    }
                });
            }).ConfigureAwait(false);
            
            var wikiFeatures = lists.SelectMany(l => l)
                .GroupBy(f => f.Attributes[FeatureAttributes.ID])
                .Select(g => g.First())
                .ToList();
            _logger.LogInformation($"Finished getting Wikipedia pages for indexing, got {wikiFeatures.Count} pages.");
            return wikiFeatures;
        }
    }
}
