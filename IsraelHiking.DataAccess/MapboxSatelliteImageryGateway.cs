using System.Net;
using System.Net.Http;
using System.IO;
using System.Threading.Tasks;
using IsraelHiking.Common;
using IsraelHiking.Common.Configuration;
using IsraelHiking.DataAccessInterfaces;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;

namespace IsraelHiking.DataAccess;

/// <inheritdoc/>
/// <remarks>
/// Uses the Mapbox raster tiles API, see https://docs.mapbox.com/api/maps/raster-tiles/.
/// The access token is a secret of this server - the tiles are proxied rather than fetched by the client
/// so that the token is never handed out, and so that only a subscribed user can reach the imagery.
/// </remarks>
public class MapboxSatelliteImageryGateway(
    IHttpClientFactory httpClientFactory,
    IOptions<NonPublicConfigurationData> options,
    ILogger logger)
    : ISatelliteImageryGateway
{
    private const string TILES_ADDRESS = "https://api.mapbox.com/v4/mapbox.satellite/";

    /// <summary>
    /// The tiles are requested at twice the size of the tile grid so that they are not blurry on a high
    /// density screen, and as jpeg since satellite imagery is a photo.
    /// </summary>
    private const string TILE_FORMAT = "@2x.jpg90";

    private readonly NonPublicConfigurationData _options = options.Value;

    /// <inheritdoc/>
    public async Task<Stream> GetTile(int z, int x, int y)
    {
        var client = httpClientFactory.CreateClient();
        client.DefaultRequestHeaders.UserAgent.ParseAdd(Branding.USER_AGENT);
        var address = $"{TILES_ADDRESS}{z}/{x}/{y}{TILE_FORMAT}?access_token={_options.MapboxAccessToken}";
        var response = await client.GetAsync(address, HttpCompletionOption.ResponseHeadersRead);
        if (response.StatusCode == HttpStatusCode.NotFound)
        {
            return null;
        }
        if (!response.IsSuccessStatusCode)
        {
            logger.LogWarning($"Unable to get a satellite imagery tile {z}/{x}/{y}, status code: {response.StatusCode}");
            return null;
        }
        return await response.Content.ReadAsStreamAsync();
    }
}
