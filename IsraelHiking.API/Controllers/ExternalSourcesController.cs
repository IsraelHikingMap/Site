using IsraelHiking.API.Executors;
using IsraelHiking.API.Services.Poi;
using IsraelHiking.Common;
using IsraelHiking.Common.Extensions;
using IsraelHiking.DataAccessInterfaces;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Logging;
using NetTopologySuite.Features;
using NetTopologySuite.Geometries;
using ProjNet.CoordinateSystems.Transformations;
using System;
using System.Collections.Concurrent;
using System.Collections.Generic;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;

namespace IsraelHiking.API.Controllers
{
    /// <summary>
    /// This contoller is responsible for external sourcing mirroning
    /// </summary>
    [Route("api/[controller]")]
    public class ExternalSourcesController : ControllerBase
    {
        private readonly IPointsOfInterestAdapterFactory _adaptersFactory;
        private readonly IElevationDataStorage _elevationDataStorage;
        private readonly IElasticSearchGateway _elasticSearchGateway;
        private readonly ILogger _logger;
        private readonly MathTransform _wgs84ItmTransform;

        /// <summary>
        /// Class constructor
        /// </summary>
        /// <param name="adaptersFactory"></param>
        /// <param name="elevationDataStorage"></param>
        /// <param name="elasticSearchGateway"></param>
        /// <param name="itmWgs84MathTransfromFactory"></param>
        /// <param name="logger"></param>
        public ExternalSourcesController(IPointsOfInterestAdapterFactory adaptersFactory,
            IElevationDataStorage elevationDataStorage,
            IElasticSearchGateway elasticSearchGateway,
            IItmWgs84MathTransfromFactory itmWgs84MathTransfromFactory,
            ILogger logger)
        {
            _adaptersFactory = adaptersFactory;
            _elevationDataStorage = elevationDataStorage;
            _elasticSearchGateway = elasticSearchGateway;
            _wgs84ItmTransform = itmWgs84MathTransfromFactory.CreateInverse();
            _logger = logger;
        }

        /// <summary>
        /// Get all the available external sources
        /// </summary>
        /// <returns></returns>
        [HttpGet]
        public IEnumerable<string> GetSources()
        {
            return _adaptersFactory.GetAll().Where(a => a.Source != Sources.OSM).Select(a => a.Source);
        }

        /// <summary>
        /// Extracts an extarnal source.
        /// </summary>
        /// <param name="source"></param>
        /// <returns></returns>
        [HttpPost]
        public async Task<IActionResult> PostRebuildSource(string source)
        {
            if (!GetSources().Contains(source) && source != "all")
            {
                return NotFound($"Source {source} does not exist");
            }
            var sources = source == "all" ? GetSources() : new[] { source };
            foreach (var currentSource in sources)
            {
                _logger.LogInformation($"Starting rebuilding {currentSource}, getting points...");
                var adapter = _adaptersFactory.GetBySource(currentSource);
                var points = await adapter.GetPointsForIndexing();
                _logger.LogInformation($"Got {points.Count} points for {currentSource}");
                var fullPoints = new ConcurrentBag<FeatureCollection>();
                await _elasticSearchGateway.DeleteExternalPoisBySource(currentSource);
                var counter = 0;
                Parallel.For(0, points.Count, new ParallelOptions { MaxDegreeOfParallelism = 10 }, (index) =>
                {
                    try
                    {
                        var feature = adapter.GetRawPointOfInterestById(points[index].Attributes[FeatureAttributes.ID].ToString()).Result;
                        var geoLocation = feature.Attributes[FeatureAttributes.POI_GEOLOCATION] as AttributesTable;
                        var geoLocationCoordinate = new Coordinate((double)geoLocation[FeatureAttributes.LON], (double)geoLocation[FeatureAttributes.LAT]);
                        feature.Attributes.AddOrUpdate(FeatureAttributes.POI_ALT, _elevationDataStorage.GetElevation(geoLocationCoordinate).Result);
                        var northEast = _wgs84ItmTransform.Transform(geoLocationCoordinate.X, geoLocationCoordinate.Y);
                        feature.Attributes.AddOrUpdate(FeatureAttributes.POI_ITM_EAST, (int)northEast.x);
                        feature.Attributes.AddOrUpdate(FeatureAttributes.POI_ITM_NORTH, (int)northEast.y);
                        _elasticSearchGateway.AddExternalPoi(feature);
                        Interlocked.Increment(ref counter);
                        if (counter % 100 == 0)
                        {
                            _logger.LogInformation($"Indexed {counter} points of {points.Count} for {currentSource}");
                        }
                    } 
                    catch (Exception ex)
                    {
                        _logger.LogError($"failed to index point with index: {index} for {currentSource} with exception: {ex.ToString()}, {points[index].ToString()}");
                    }
                    
                });
                _logger.LogInformation($"Finished rebuilding {currentSource}, indexed {points.Count} points.");
                // HM TODO: set rebuild date for source somehow...
            }
            return Ok();
        }

        /// <summary>
        /// Updates an external source from the last time it was updated.
        /// </summary>
        /// <param name="source"></param>
        /// <returns></returns>
        [HttpPut]
        public IActionResult PutUpdateSource(string source)
        {
            var adapter = _adaptersFactory.GetBySource(source);
            if (adapter == null)
            {
                return NotFound();
            }
            // HM TODO: get the source last update date and figure out what has changed since.
            // Mainly: deleted, added, updated.
            return Ok();
        }
    }
}