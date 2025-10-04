using System;
using System.Collections.Generic;
using System.IO;

namespace IsraelHiking.API.Services;

/// <summary>
/// A service responsible for offline files location and get who was updated
/// </summary>
public interface IOfflineFilesService
{
    /// <summary>
    /// Get the file's content 
    /// </summary>
    /// <param name="fileRelativePath">The file to get</param>
    /// <returns>a read stream of the file</returns>
    Stream GetFileContent(string fileRelativePath);

    /// <summary>
    /// Get a list of files that have been updated since a given date
    /// </summary>
    /// <param name="lastModifiedDate">The date to check against</param>
    /// <param name="tileX">The tile's X coordinates, null for root</param>
    /// <param name="tileY">The tile's Y coordinates, null for root</param>
    /// <returns>A list of file names</returns>
    Dictionary<string, DateTime> GetUpdatedFilesList(DateTime lastModifiedDate, long? tileX, long? tileY);


    /// <summary>
    /// Get the date of the last scheme break
    /// </summary>
    /// <returns>The date of the last scheme break</returns>
    DateTime GetLastSchemeBreakDate();
}