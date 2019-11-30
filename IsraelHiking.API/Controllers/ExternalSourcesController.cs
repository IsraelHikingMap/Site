using IsraelHiking.API.Services.Poi;
using IsraelHiking.Common;
using IsraelHiking.Common.Extensions;
using IsraelHiking.DataAccessInterfaces;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Logging;
using NetTopologySuite.Features;
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
        private readonly IElasticSearchGateway _elasticSearchGateway;
        private readonly ILogger _logger;

        /// <summary>
        /// Class constructor
        /// </summary>
        /// <param name="adaptersFactory"></param>
        /// <param name="elasticSearchGateway"></param>
        /// <param name="logger"></param>
        public ExternalSourcesController(IPointsOfInterestAdapterFactory adaptersFactory,
            IElasticSearchGateway elasticSearchGateway,
            ILogger logger)
        {
            _adaptersFactory = adaptersFactory;
            _elasticSearchGateway = elasticSearchGateway;
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
            var adapter = _adaptersFactory.GetBySource(source);
            if (adapter == null)
            {
                return NotFound($"Source {source} does not exist");
            }
            _logger.LogInformation($"Starting rebuilding {source}, getting points...");
            var points = await adapter.GetPointsForIndexing();
            _logger.LogInformation($"Got {points.Count} points for {source}");
            var fullPoints = new ConcurrentBag<FeatureCollection>();
            await _elasticSearchGateway.DeleteExternalPoisBySource(source);
            var counter = 0;
            Parallel.For(0, points.Count, new ParallelOptions { MaxDegreeOfParallelism = 10 }, (index) =>
            {
                var featureCollection = adapter.GetRawPointOfInterestById(points[index].Attributes[FeatureAttributes.ID].ToString()).Result;
                _elasticSearchGateway.AddExternalPoi(featureCollection);
                Interlocked.Increment(ref counter);
                if (counter % 100 == 0)
                {
                    _logger.LogInformation($"Indexed {counter} points of {points.Count} for {source}");
                }
            });
            _logger.LogInformation($"Finished rebuilding {source}, indexed {points.Count} points.");
            // HM TODO: set rebuild date for source somehow...
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