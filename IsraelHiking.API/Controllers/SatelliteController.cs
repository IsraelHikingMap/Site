using System;
using System.Threading.Tasks;
using IsraelHiking.DataAccessInterfaces;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Caching.Memory;
using Microsoft.Extensions.Logging;

namespace IsraelHiking.API.Controllers;

/// <summary>
/// This controller serves the satellite imagery tiles to subscribed users
/// </summary>
/// <remarks>
/// The imagery comes from a commercial provider that bills per tile, so the tiles are proxied by this
/// server: the provider's access key stays here, and only a subscribed user gets to see the imagery.
/// </remarks>
[Route("api/[controller]")]
[ApiController]
public class SatelliteController : ControllerBase
{
    /// <summary>
    /// How long the client is told to keep a tile - satellite imagery hardly ever changes.
    /// </summary>
    private const int TILE_CACHE_SECONDS = 7 * 24 * 60 * 60;

    /// <summary>
    /// How long an entitlement answer is reused. A tile request can not afford a round trip to the
    /// receipt validators, and a subscription does not change from one tile to the next.
    /// </summary>
    private static readonly TimeSpan ENTITLEMENT_CACHE_DURATION = TimeSpan.FromMinutes(10);

    private readonly ISatelliteImageryGateway _satelliteImageryGateway;
    private readonly IReceiptValidationGateway _receiptValidationGateway;
    private readonly IMemoryCache _memoryCache;
    private readonly ILogger _logger;

    /// <summary>
    /// Controller's constructor
    /// </summary>
    /// <param name="satelliteImageryGateway"></param>
    /// <param name="receiptValidationGateway"></param>
    /// <param name="memoryCache"></param>
    /// <param name="logger"></param>
    public SatelliteController(ISatelliteImageryGateway satelliteImageryGateway,
        IReceiptValidationGateway receiptValidationGateway,
        IMemoryCache memoryCache,
        ILogger logger)
    {
        _satelliteImageryGateway = satelliteImageryGateway;
        _receiptValidationGateway = receiptValidationGateway;
        _memoryCache = memoryCache;
        _logger = logger;
    }

    /// <summary>
    /// Get a satellite imagery tile
    /// </summary>
    /// <remarks>Returns a single raster tile of the satellite imagery. Requires an entitled (subscribed) user.</remarks>
    /// <param name="z">The tile's zoom level</param>
    /// <param name="x">The tile's X coordinate</param>
    /// <param name="y">The tile's Y coordinate</param>
    /// <returns>A jpeg image of the tile</returns>
    [HttpGet]
    [Route("{z:int}/{x:int}/{y:int}")]
    [Authorize]
    public async Task<IActionResult> GetTile(int z, int x, int y)
    {
        if (!await IsEntitled())
        {
            _logger.LogInformation($"Unable to get a satellite imagery tile for user: {User.Identity?.Name} since the user is not entitled");
            return Forbid();
        }
        var content = await _satelliteImageryGateway.GetTile(z, x, y);
        if (content == null)
        {
            return NotFound();
        }
        Response.Headers.CacheControl = $"private, max-age={TILE_CACHE_SECONDS}";
        return File(content, "image/jpeg");
    }

    /// <inheritdoc cref="ENTITLEMENT_CACHE_DURATION"/>
    private Task<bool> IsEntitled()
    {
        var userId = User.Identity?.Name;
        return _memoryCache.GetOrCreateAsync("satellite-entitlement-" + userId, entry =>
        {
            entry.AbsoluteExpirationRelativeToNow = ENTITLEMENT_CACHE_DURATION;
            return _receiptValidationGateway.IsEntitled(userId);
        });
    }
}
