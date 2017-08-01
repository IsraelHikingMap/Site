using IsraelHiking.API.Executors;
using IsraelHiking.API.Swagger;
using IsraelHiking.DataAccessInterfaces;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Logging;
using Swashbuckle.AspNetCore.SwaggerGen;
using System.IO;
using System.Linq;
using System.Net;
using System.Threading.Tasks;

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

        /// <summary>
        /// Controller's constructor
        /// </summary>
        /// <param name="graphHopperGateway"></param>
        /// <param name="elasticSearchGateway"></param>
        /// <param name="osmGeoJsonPreprocessorExecutor"></param>
        /// <param name="osmRepository"></param>
        /// <param name="logger"></param>
        public UpdateController(IGraphHopperGateway graphHopperGateway,
            IElasticSearchGateway elasticSearchGateway,
            IOsmGeoJsonPreprocessorExecutor osmGeoJsonPreprocessorExecutor,
            IOsmRepository osmRepository,
            ILogger logger)
        {
            _graphHopperGateway = graphHopperGateway;
            _elasticSearchGateway = elasticSearchGateway;
            _osmGeoJsonPreprocessorExecutor = osmGeoJsonPreprocessorExecutor;
            _osmRepository = osmRepository;
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
        [SwaggerOperationFilter(typeof(RequiredFileUploadParams))]
        public async Task<IActionResult> PostUpdateData(IFormFile file)
        {
            if (HttpContext.Connection.LocalIpAddress.Equals(HttpContext.Connection.RemoteIpAddress) == false &&
                IPAddress.IsLoopback(HttpContext.Connection.RemoteIpAddress) == false &&
                HttpContext.Connection.RemoteIpAddress.Equals(IPAddress.Parse("10.10.10.10")) == false)
            {
                return BadRequest($"This operation can't be done from a remote client, please run this from the server: \n {HttpContext.Connection.LocalIpAddress}, {HttpContext.Connection.RemoteIpAddress}, {IPAddress.Parse("10.10.10.10")}");
            }
            if (file == null)
            {
                return BadRequest("No file was provided");
            }
            _logger.LogInformation("Updating Elastic Search and graphhopper OSM data");
            var memoryStream = new MemoryStream();
            file.OpenReadStream().CopyTo(memoryStream);
            _logger.LogInformation("Copy uploaded data completed.");
            var elasticSearchTask = Task.Run(async () =>
            {
                var osmNamesDictionary = await _osmRepository.GetElementsWithName(memoryStream);
                var geoJsonNamesDictionary = _osmGeoJsonPreprocessorExecutor.Preprocess(osmNamesDictionary);
                var osmHighways = await _osmRepository.GetAllHighways(memoryStream);
                var geoJsonHighways = _osmGeoJsonPreprocessorExecutor.Preprocess(osmHighways);
                await _elasticSearchGateway.UpdateDataZeroDownTime(geoJsonNamesDictionary.Values.SelectMany(v => v).ToList(), geoJsonHighways);
            });
            var graphHopperTask = _graphHopperGateway.Rebuild(memoryStream, file.FileName);
            await Task.WhenAll(elasticSearchTask, graphHopperTask);
            return Ok();
        }
    }
}
