using IsraelHiking.API.Executors;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Logging;
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
        private readonly IOsmLatestFileFetcherExecutor _osmLatestFileFetcherExecutor;
        private readonly IElasticSearchUpdaterService _elasticSearchUpdaterService;

        /// <summary>
        /// Controller's constructor
        /// </summary>
        /// <param name="osmLatestFileFetcherExecutor"></param>
        /// <param name="elasticSearchUpdaterService"></param>
        /// <param name="logger"></param>
        public UpdateController(
            IOsmLatestFileFetcherExecutor osmLatestFileFetcherExecutor,
            IElasticSearchUpdaterService elasticSearchUpdaterService,
            ILogger logger)
        {
            _osmLatestFileFetcherExecutor = osmLatestFileFetcherExecutor;
            _elasticSearchUpdaterService = elasticSearchUpdaterService;
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
                _logger.LogInformation("Updating site's databases according to request: " + JsonConvert.SerializeObject(request));
                await _osmLatestFileFetcherExecutor.Update(request.OsmFile);
                _logger.LogInformation("Update OSM file completed.");

                await _elasticSearchUpdaterService.Rebuild(request);
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
                _logger.LogInformation("Starting incremental site's databases update");
                using (var updatesStream = await _osmLatestFileFetcherExecutor.GetUpdates())
                {
                    XmlSerializer serializer = new XmlSerializer(typeof(OsmChange));
                    var changes = (OsmChange) serializer.Deserialize(updatesStream);
                    await _elasticSearchUpdaterService.Update(changes);
                }
                _logger.LogInformation("Finished incremental site's databases update");
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
