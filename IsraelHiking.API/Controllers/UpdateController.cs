using System.Collections.Generic;
using IsraelHiking.API.Executors;
using IsraelHiking.DataAccessInterfaces;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Logging;
using System.IO;
using System.Linq;
using System.Net;
using System.Threading.Tasks;
using IsraelHiking.API.Services.Poi;
using IsraelHiking.Common;
using Newtonsoft.Json;

namespace IsraelHiking.API.Controllers
{
    /// <summary>
    /// This controller handles updates in elastic search and graphhopper
    /// </summary>
    [Route("api/[controller]")]
    public class UpdateController : Controller
    {
        private readonly ILogger _logger;
        private readonly IGraphHopperGateway _graphHopperGateway;
        private readonly IElasticSearchGateway _elasticSearchGateway;
        private readonly IOsmGeoJsonPreprocessorExecutor _osmGeoJsonPreprocessorExecutor;
        private readonly IOsmRepository _osmRepository;
        private readonly IEnumerable<IPointsOfInterestAdapter> _adapters;
        private readonly IOsmLatestFileFetcher _osmLatestFileFetcher;

        /// <summary>
        /// Controller's constructor
        /// </summary>
        /// <param name="graphHopperGateway"></param>
        /// <param name="elasticSearchGateway"></param>
        /// <param name="osmGeoJsonPreprocessorExecutor"></param>
        /// <param name="osmRepository"></param>
        /// <param name="osmLatestFileFetcher"></param>
        /// <param name="adapters"></param>
        /// <param name="logger"></param>
        public UpdateController(IGraphHopperGateway graphHopperGateway,
            IElasticSearchGateway elasticSearchGateway,
            IOsmGeoJsonPreprocessorExecutor osmGeoJsonPreprocessorExecutor,
            IOsmRepository osmRepository,
            IOsmLatestFileFetcher osmLatestFileFetcher,
            IEnumerable<IPointsOfInterestAdapter> adapters,
            ILogger logger)
        {
            _graphHopperGateway = graphHopperGateway;
            _elasticSearchGateway = elasticSearchGateway;
            _osmGeoJsonPreprocessorExecutor = osmGeoJsonPreprocessorExecutor;
            _osmRepository = osmRepository;
            _osmLatestFileFetcher = osmLatestFileFetcher;
            _adapters = adapters;
            _logger = logger;

        }

        /// <summary>
        /// This operation updates elastic search and graph hopper with data stored in osm pbf file.
        /// This opertaion should have minimal down time.
        /// This operation can only be ran from the hosting server.
        /// </summary>
        /// <returns></returns>
        [HttpPost]
        [Route("")]
        public async Task<IActionResult> PostUpdateData(UpdateRequest request)
        {
            if (HttpContext.Connection.LocalIpAddress.Equals(HttpContext.Connection.RemoteIpAddress) == false &&
                IPAddress.IsLoopback(HttpContext.Connection.RemoteIpAddress) == false &&
                HttpContext.Connection.RemoteIpAddress.Equals(IPAddress.Parse("10.10.10.10")) == false)
            {
                return BadRequest($"This operation can't be done from a remote client, please run this from the server: \n {HttpContext.Connection.LocalIpAddress}, {HttpContext.Connection.RemoteIpAddress}, {IPAddress.Parse("10.10.10.10")}");
            }
            if (request == null || request.Routing == false &&
                request.Highways == false &&
                request.PointsOfInterest == false)
            {
                request = new UpdateRequest
                {
                    Routing = true,
                    Highways = true,
                    PointsOfInterest = true
                };
                _logger.LogInformation("No specific filters were applied, updating all databases.");
            }
            _logger.LogInformation("Updating site's databases according to request:\n" + JsonConvert.SerializeObject(request));
            var memoryStream = new MemoryStream();
            var stream = await _osmLatestFileFetcher.Get();
            stream.CopyTo(memoryStream);
            _logger.LogInformation("Copy osm data completed.");

            var elasticSearchTask = UpdateElasticSearch(request, memoryStream);

            var graphHopperTask = request.Routing
                ? _graphHopperGateway.Rebuild(memoryStream, Sources.OSM_FILE_NAME)
                : Task.CompletedTask;

            await Task.WhenAll(elasticSearchTask, graphHopperTask);
            return Ok();
        }

        private async Task UpdateElasticSearch(UpdateRequest request, MemoryStream memoryStream)
        {
            if (request.Highways)
            {
                _logger.LogInformation("Starting updating highways database.");
                var osmHighways = await _osmRepository.GetAllHighways(memoryStream);
                var geoJsonHighways = _osmGeoJsonPreprocessorExecutor.Preprocess(osmHighways);
                await _elasticSearchGateway.UpdateHighwaysZeroDownTime(geoJsonHighways);
                _logger.LogInformation("Finished updating highways database.");
            }
            if (request.PointsOfInterest)
            {
                _logger.LogInformation("Starting updating POIs database.");
                var fetchTask = _adapters.Select(a => a.GetPointsForIndexing(memoryStream)).ToArray();
                var features = await Task.WhenAll(fetchTask);
                await _elasticSearchGateway.UpdatePointsOfInterestZeroDownTime(features.SelectMany(v => v).ToList());
                _logger.LogInformation("Finished updating POIs database.");
            }
        }
    }
}
