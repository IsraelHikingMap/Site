using IsraelHiking.Common.Configuration;
using IsraelHiking.DataAccessInterfaces;
using Microsoft.Extensions.FileProviders;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using System;
using System.Collections.Generic;
using System.Globalization;
using System.IO;
using System.Threading.Tasks;

namespace IsraelHiking.API.Services;

/// <inheritdoc/>
public class OfflineFilesService : IOfflineFilesService
{
    // The zoom level at which the map is split into tiles - matches the folder structure of the offline files.
    private const int SLICE_TILE_ZOOM = 7;
    // The zoom level of the root (non-tiled) overview files.
    private const int ROOT_ZOOM = 6;

    // The files that are served from the file system (jaxa), together with the fixed last modified date reported for
    // each of them. These files only exist at the tile level. The date is bumped whenever the underlying data changes.
    private static readonly Dictionary<string, DateTime> FileSystemTileFiles = new()
    {
        //["JAXA_AW3D30_2024_contour_z5-Z12_vector"] = DateTimeOffset.Parse("2026-03-29T16:23:58.9435596Z", CultureInfo.InvariantCulture).UtcDateTime,
        ["jaxa_terrarium0-11_v2"] = DateTimeOffset.Parse("2026-04-09T10:36:08.8024764Z", CultureInfo.InvariantCulture).UtcDateTime
    };

    private readonly IFileProvider _fileProvider;
    private readonly IRemoteFileFetcherGateway _remoteFileFetcherGateway;
    private readonly string _onTheFlyFilesAddress;
    private readonly List<string> _onTheFlyFileNames;

    /// <summary>
    /// Constructor
    /// </summary>
    /// <param name="fileSystemHelper"></param>
    /// <param name="remoteFileFetcherGateway"></param>
    /// <param name="options"></param>
    /// <param name="logger"></param>
    public OfflineFilesService(IFileSystemHelper fileSystemHelper,
        IRemoteFileFetcherGateway remoteFileFetcherGateway,
        IOptions<ConfigurationData> options,
        ILogger logger)
    {
        _remoteFileFetcherGateway = remoteFileFetcherGateway;
        _onTheFlyFilesAddress = options.Value.OnTheFlyFilesAddress;
        _onTheFlyFileNames = options.Value.OnTheFlyFileNames ?? [];
        if (string.IsNullOrEmpty(options.Value.OfflineFilesFolder))
        {
            logger.LogWarning("offlineFilesFolder was not provided! This mean you won't be able to use this service");
        }
        else
        {
            _fileProvider = fileSystemHelper.CreateFileProvider(options.Value.OfflineFilesFolder);
        }
    }

    /// <inheritdoc/>
    public Dictionary<string, DateTime> GetUpdatedFilesList(DateTime lastModifiedDate, long? tileX, long? tileY)
    {
        var filesDictionary = new Dictionary<string, DateTime>();
        // The on-the-fly files are generated on demand, so they are always reported with today's date.
        var today = DateTime.UtcNow.Date;
        foreach (var name in _onTheFlyFileNames)
        {
            AddIfUpdated(filesDictionary, BuildFileName(name, tileX, tileY), today, lastModifiedDate);
        }
        // The file system (jaxa) files only exist at the tile level.
        if (tileX.HasValue && tileY.HasValue)
        {
            foreach (var (name, date) in FileSystemTileFiles)
            {
                AddIfUpdated(filesDictionary, BuildFileName(name, tileX, tileY), date, lastModifiedDate);
            }
        }
        return filesDictionary;
    }

    /// <inheritdoc/>
    public async Task<(Stream Content, long? Length)> GetFileContent(string fileName, long? tileX, long? tileY)
    {
        if (_onTheFlyFileNames.Contains(GetLayerName(fileName)))
        {
            return await _remoteFileFetcherGateway.GetFileStream(_onTheFlyFilesAddress + fileName);
        }
        var relativePath = tileX.HasValue && tileY.HasValue
            ? $"{SLICE_TILE_ZOOM}/{tileX}/{tileY}/{fileName}"
            : fileName;
        var fileInfo = _fileProvider.GetFileInfo(relativePath);
        return (fileInfo.CreateReadStream(), fileInfo.Length);
    }

    private static void AddIfUpdated(Dictionary<string, DateTime> filesDictionary, string fileName, DateTime fileModifiedDate, DateTime lastModifiedDate)
    {
        if (lastModifiedDate != DateTime.MinValue &&
            lastModifiedDate.ToUniversalTime() >= fileModifiedDate.ToUniversalTime())
        {
            return;
        }
        filesDictionary[fileName] = fileModifiedDate;
    }

    private static string BuildFileName(string name, long? tileX, long? tileY)
    {
        return tileX.HasValue && tileY.HasValue
            ? $"{name}+{SLICE_TILE_ZOOM}-{tileX}-{tileY}.pmtiles"
            : $"{name}-{ROOT_ZOOM}.pmtiles";
    }

    /// <summary>
    /// Extracts the layer name from an offline file name, dropping the zoom/tile suffix.
    /// Tile files look like "name+7-x-y.pmtiles" and root files look like "name-6.pmtiles",
    /// where the layer name itself may contain '-' (e.g. "IHM-schema", "jaxa_terrarium0-11_v2").
    /// </summary>
    private static string GetLayerName(string fileName)
    {
        var plusIndex = fileName.IndexOf('+');
        if (plusIndex >= 0)
        {
            return fileName[..plusIndex];
        }
        var name = fileName.EndsWith(".pmtiles", StringComparison.Ordinal)
            ? fileName[..^".pmtiles".Length]
            : fileName;
        var lastDashIndex = name.LastIndexOf('-');
        return lastDashIndex >= 0 ? name[..lastDashIndex] : name;
    }
}
