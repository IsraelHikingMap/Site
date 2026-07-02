using IsraelHiking.API.Services.Osm;
using IsraelHiking.Common.Api;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Logging;
using System.Net;
using System.Text.Json;
using System.Threading;
using System.Threading.Tasks;

namespace IsraelHiking.API.Controllers;

/// <summary>
/// This controller handles updates in elastic search
/// </summary>
[Route("api/[controller]")]
[ApiController]
public class UpdateController : ControllerBase
{
    private static readonly Semaphore RebuildSemaphore = new(1, 1);

    private readonly ILogger _logger;
    private readonly IDatabasesUpdaterService _databasesUpdaterService;

    /// <summary>
    /// Controller's constructor
    /// </summary>
    /// <param name="databasesUpdaterService"></param>
    /// <param name="logger"></param>
    public UpdateController(
        IDatabasesUpdaterService databasesUpdaterService,
        ILogger logger)
    {
        _databasesUpdaterService = databasesUpdaterService;
        _logger = logger;
    }

    /// <summary>
    /// Update search databases
    /// </summary>
    /// <remarks>
    /// Updates Elasticsearch and GraphHopper from the OSM PBF file. If OsmFile is false, downloads and uses
    /// the daily file without updating it to the latest version. Runs with minimal downtime and can only be
    /// invoked from the hosting server.
    /// </remarks>
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
                request.AllExternalSources == false &&
                request.Images == false &&
                request.SiteMap == false &&
                request.OfflinePoisFile == false)
            {
                request = new UpdateRequest
                {
                    AllExternalSources = true,
                    SiteMap = true,
                    Images = true,
                    OfflinePoisFile = true
                };
                _logger.LogInformation("No specific filters were applied, updating all databases.");
            }
            _logger.LogInformation("Starting updating site's databases according to request: " + JsonSerializer.Serialize(request));
            await _databasesUpdaterService.Rebuild(request);
            _logger.LogInformation("Finished updating site's databases according to request");
            return Ok();
        }
        finally
        {
            RebuildSemaphore.Release();
        }
    }

    private bool IsRequestLocal()
    {
        return HttpContext.Connection.LocalIpAddress.Equals(HttpContext.Connection.RemoteIpAddress) ||
               IPAddress.IsLoopback(HttpContext.Connection.RemoteIpAddress) ||
               HttpContext.Connection.RemoteIpAddress.Equals(IPAddress.Parse("10.10.10.10"));
    }
}