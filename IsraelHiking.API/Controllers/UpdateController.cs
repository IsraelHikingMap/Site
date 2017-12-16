using IsraelHiking.API.Executors;
using IsraelHiking.DataAccessInterfaces;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Logging;
using System.IO;
using System.Net;
using System.Threading;
using System.Threading.Tasks;
using System.Xml.Serialization;
using IsraelHiking.API.Services.Osm;
using IsraelHiking.Common;
using Newtonsoft.Json;
using OsmSharp.Changesets;

namespace IsraelHiking.API.Controllers
{
    /// <summary>
    /// This controller handles updates in elastic search and graphhopper
    /// </summary>
    [Route("api/[controller]")]
    public class UpdateController : Controller
    {
        private static readonly Semaphore RebuildSemaphore = new Semaphore(1, 1);
        private static readonly SemaphoreSlim UpdateSemaphore = new SemaphoreSlim(1, 1);

        private readonly ILogger _logger;
        private readonly IGraphHopperGateway _graphHopperGateway;
        private readonly IOsmLatestFileFetcher _osmLatestFileFetcher;
        private readonly IOsmElasticSearchUpdaterService _osmElasticSearchUpdaterService;

        /// <summary>
        /// Controller's constructor
        /// </summary>
        /// <param name="graphHopperGateway"></param>
        /// <param name="osmLatestFileFetcher"></param>
        /// <param name="osmElasticSearchUpdaterService"></param>
        /// <param name="logger"></param>
        public UpdateController(IGraphHopperGateway graphHopperGateway,
            IOsmLatestFileFetcher osmLatestFileFetcher,
            IOsmElasticSearchUpdaterService osmElasticSearchUpdaterService,
            ILogger logger)
        {
            _graphHopperGateway = graphHopperGateway;
            _osmLatestFileFetcher = osmLatestFileFetcher;
            _osmElasticSearchUpdaterService = osmElasticSearchUpdaterService;
            _logger = logger;
            
        }

        /// <summary>
        /// This operation updates elastic search and graph hopper with data stored in osm pbf file.
        /// If OsmFile is set to false it will download and use the daily file without updating it to latest version.
        /// This opertaion should have minimal down time.
        /// This operation can only be ran from the hosting server.
        /// </summary>
        /// <returns></returns>
        [HttpPost]
        [Route("")]
        public async Task<IActionResult> PostUpdateData(UpdateRequest request)
        {
            if (!RebuildSemaphore.WaitOne(0))
            {
                return BadRequest("Can't run two full updates in parallel");
            }
            try
            {
                if (!IsRequestLocal())
                {
                    return BadRequest("This operation can't be done from a remote client, please run this from the server");
                }
                if (request == null || 
                    request.Routing == false &&
                    request.Highways == false &&
                    request.PointsOfInterest == false &&
                    request.OsmFile == false)
                {
                    request = new UpdateRequest
                    {
                        Routing = true,
                        Highways = true,
                        PointsOfInterest = true,
                        OsmFile = true
                    };
                    _logger.LogInformation("No specific filters were applied, updating all databases.");
                }
                _logger.LogInformation("Updating site's databases according to request: " +
                                       JsonConvert.SerializeObject(request));
                var memoryStream = new MemoryStream();
                using (var stream = await _osmLatestFileFetcher.Get(request.OsmFile))
                {
                    stream.CopyTo(memoryStream);
                }
                _logger.LogInformation("Copy osm data completed.");

                var elasticSearchTask = _osmElasticSearchUpdaterService.Rebuild(request, memoryStream);

                var graphHopperTask = request.Routing
                    ? _graphHopperGateway.Rebuild(memoryStream, Sources.OSM_FILE_NAME)
                    : Task.CompletedTask;

                await Task.WhenAll(elasticSearchTask, graphHopperTask);
                return Ok();
            }
            finally
            {
                RebuildSemaphore.Release();
            }
        }

        

        /// <summary>
        /// This operation will only update the data since last full update
        /// It will only add missing data to the database
        /// It will not run when a full update runs
        /// </summary>
        /// <returns></returns>
        [HttpPut]
        [Route("")]
        public async Task<IActionResult> PutUpdateData()
        {
            if (!IsRequestLocal())
            {
                return BadRequest("This operation can't be done from a remote client, please run this from the server");
            }
            if (!RebuildSemaphore.WaitOne(0))
            {
                return BadRequest("Can't run update while full update is running");
            }
            RebuildSemaphore.Release();
            await UpdateSemaphore.WaitAsync();
            try
            {
                _logger.LogInformation("Starting incrementail site's databases update");
                using (var updatesStream = await _osmLatestFileFetcher.GetUpdates())
                {
                    XmlSerializer serializer = new XmlSerializer(typeof(OsmChange));
                    var changes = (OsmChange) serializer.Deserialize(updatesStream);
                    await _osmElasticSearchUpdaterService.Update(changes);
                }
                _logger.LogInformation("Finished Incrementail site's databases update");
                return Ok();
            }
            finally
            {
                UpdateSemaphore.Release();
            }
        }

        private bool IsRequestLocal()
        {
            return HttpContext.Connection.LocalIpAddress.Equals(HttpContext.Connection.RemoteIpAddress) ||
                   IPAddress.IsLoopback(HttpContext.Connection.RemoteIpAddress) ||
                   HttpContext.Connection.RemoteIpAddress.Equals(IPAddress.Parse("10.10.10.10"));
        }
    }
}
