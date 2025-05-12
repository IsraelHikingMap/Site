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
/// This controller handles updates in elastic search and graphhopper
/// </summary>
[Route("api/[controller]")]
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
    /// This operation updates elastic search and graph hopper with data stored in osm pbf file.
    /// If OsmFile is set to false it will download and use the daily file without updating it to latest version.
    /// This operation should have minimal downtime.
    /// This operation can only be run from the hosting server.
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