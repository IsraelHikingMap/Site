using System;
using System.Collections.Generic;
using System.IO;
using System.Threading.Tasks;

namespace IsraelHiking.API.Services;

/// <summary>
/// A service responsible for offline files location and get who was updated
/// </summary>
public interface IOfflineFilesService
{
    /// <summary>
    /// Get the file's content
    /// </summary>
    /// <param name="fileName">The file to get</param>
    /// <param name="tileX">The tile's X coordinates, null for root</param>
    /// <param name="tileY">The tile's Y coordinates, null for root</param>
    /// <returns>a read stream of the file and its length when known</returns>
    Task<(Stream Content, long? Length)> GetFileContent(string fileName, long? tileX, long? tileY);

    /// <summary>
    /// Get a list of files that have been updated since a given date
    /// </summary>
    /// <param name="lastModifiedDate">The date to check against</param>
    /// <param name="tileX">The tile's X coordinates, null for root</param>
    /// <param name="tileY">The tile's Y coordinates, null for root</param>
    /// <param name="routingTile">Whether the client can handle the offline routing files - the routing tile
    /// itself and, for the root, the valhalla configuration files</param>
    /// <remarks>
    /// The order of the files is meaningful: the client downloads them in the order they are listed in, a
    /// few at a time, so a file that is listed last is the one left downloading on its own once every other
    /// file is done. The slowest files are therefore listed first, so that they are downloaded alongside the
    /// rest instead of after them.
    /// </remarks>
    /// <returns>A list of file names</returns>
    Task<Dictionary<string, DateTime>> GetUpdatedFilesList(DateTime lastModifiedDate, long? tileX, long? tileY, bool routingTile);
}