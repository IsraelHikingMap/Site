using System.IO;
using System.Threading.Tasks;

namespace IsraelHiking.DataAccessInterfaces;

/// <summary>
/// this gateway will allow getting the latest OSM pbf file
/// </summary>
public interface IOsmLatestFileGateway
{
    /// <summary>
    /// Gets a stream to the OSM file
    /// </summary>
    /// <returns>The OSM file stream</returns>
    Task<Stream> Get();
}