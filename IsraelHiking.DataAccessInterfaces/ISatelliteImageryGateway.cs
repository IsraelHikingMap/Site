using System.IO;
using System.Threading.Tasks;

namespace IsraelHiking.DataAccessInterfaces;

/// <summary>
/// Fetches satellite imagery tiles from the imagery provider, whose access key this server holds.
/// </summary>
public interface ISatelliteImageryGateway
{
    /// <summary>
    /// Gets a single satellite imagery tile in order to proxy it to the client
    /// </summary>
    /// <param name="z">The tile's zoom level</param>
    /// <param name="x">The tile's X coordinate</param>
    /// <param name="y">The tile's Y coordinate</param>
    /// <returns>A read stream of the tile's image, null when the provider has no imagery for that tile</returns>
    Task<Stream> GetTile(int z, int x, int y);
}
