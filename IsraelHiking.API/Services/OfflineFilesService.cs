using IsraelHiking.Common.Configuration;
using IsraelHiking.DataAccessInterfaces;
using Microsoft.Extensions.FileProviders;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using System;
using System.Collections.Generic;
using System.Globalization;
using System.IO;
using System.Text.Json;
using System.Threading.Tasks;

namespace IsraelHiking.API.Services;

/// <inheritdoc/>
public class OfflineFilesService : IOfflineFilesService
{
    /// <summary>
    /// The zoom level at which the map is split into tiles - matches the folder structure of the offline files.
    /// </summary>
    private const int SLICE_TILE_ZOOM = 7;

    /// <summary>
    /// The zoom level of the root (non-tiled) overview files.
    /// </summary>
    private const int ROOT_ZOOM = 6;

    /// <summary>
    /// The style that defines which sources (i.e. offline files) the client needs.
    /// </summary>
    private const string STYLE_ADDRESS = "https://raw.githubusercontent.com/IsraelHikingMap/VectorMap/master/Styles/mapeak-hike.json";

    /// <summary>
    /// Sources whose name contains this are not downloaded for offline usage.
    /// </summary>
    private const string CONTOUR = "contour";

    /// <summary>
    /// This source is not a part of the style but is still needed for offline usage.
    /// </summary>
    private const string GLOBAL_POINTS = "global_points";

    /// <summary>
    /// How long the sources list taken from the style is reused before fetching the style again.
    /// </summary>
    private static readonly TimeSpan STYLE_CACHE_DURATION = TimeSpan.FromMinutes(10);

    private const int STYLE_FETCH_ATTEMPTS = 3;
    private static readonly TimeSpan STYLE_FETCH_RETRY_DELAY = TimeSpan.FromSeconds(1);

    /// <summary>
    /// The DEM (jaxa) is the only source that is not generated on the fly but sliced in advance and served from the
    /// file system. It only exists at the tile level, and its file name in the style might be an alias to the file
    /// name on disk, in which case the alias is the name reported to and used by the client.
    /// </summary>
    private const string DEM_FILE_NAME = "jaxa_terrarium0-11_v2";

    /// <inheritdoc cref="DEM_FILE_NAME"/>
    private const string DEM_ALIAS_FILE_NAME = "raster-dem";

    /// <summary>
    /// The fixed last modified date reported for the DEM, bumped whenever the underlying data changes.
    /// </summary>
    private static readonly DateTime DEM_MODIFIED_DATE = DateTimeOffset.Parse("2026-04-09T10:36:08.8024764Z", CultureInfo.InvariantCulture).UtcDateTime;

    private readonly IFileProvider _fileProvider;
    private readonly IRemoteFileFetcherGateway _remoteFileFetcherGateway;
    private readonly ILogger _logger;
    private readonly ConfigurationData _options;
    private List<string> _sourceNames;
    private DateTime _sourceNamesExpiryDate = DateTime.MinValue;

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
        _logger = logger;
        _options = options.Value;
        if (string.IsNullOrEmpty(_options.OfflineFilesFolder))
        {
            logger.LogWarning("offlineFilesFolder was not provided! This mean you won't be able to use this service");
        }
        else
        {
            _fileProvider = fileSystemHelper.CreateFileProvider(options.Value.OfflineFilesFolder);
        }
    }

    /// <inheritdoc/>
    /// <remarks>
    /// The on-the-fly files are generated on demand, so they are always reported with today's date,
    /// while the DEM file has a fixed date and only exists at the tile level.
    /// </remarks>
    public async Task<Dictionary<string, DateTime>> GetUpdatedFilesList(DateTime lastModifiedDate, long? tileX, long? tileY)
    {
        var filesDictionary = new Dictionary<string, DateTime>();
        var today = DateTime.UtcNow.Date;
        foreach (var name in await GetSourceNames())
        {
            if (!IsDem(name))
            {
                AddIfUpdated(filesDictionary, SourceNameToFileName(name, tileX, tileY), today, lastModifiedDate);
                continue;
            }

            if (tileX.HasValue && tileY.HasValue)
            {
                AddIfUpdated(filesDictionary, SourceNameToFileName(name, tileX, tileY), DEM_MODIFIED_DATE, lastModifiedDate);
            }
        }
        return filesDictionary;
    }

    /// <inheritdoc/>
    /// <remarks>
    /// The DEM might be requested by its alias name, but it is stored on disk under its original name.
    /// </remarks>
    public async Task<(Stream Content, long? Length)> GetFileContent(string fileName, long? tileX, long? tileY)
    {
        var sourceName = FileNameToSourceName(fileName);
        if (!IsDem(sourceName))
        {
            return await _remoteFileFetcherGateway.GetFileStream(_options.OnTheFlyFilesAddress + fileName);
        }
        var demFileName = DEM_FILE_NAME + fileName[sourceName.Length..];
        var relativePath = tileX.HasValue && tileY.HasValue
            ? $"{SLICE_TILE_ZOOM}/{tileX}/{tileY}/{demFileName}"
            : demFileName;
        var fileInfo = _fileProvider.GetFileInfo(relativePath);
        return (fileInfo.CreateReadStream(), fileInfo.Length);
    }

    /// <summary>
    /// Gets the names of the files that are needed for offline usage, based on the sources of the style,
    /// without the contours and with the global points added.
    /// </summary>
    private async Task<List<string>> GetSourceNames()
    {
        if (_sourceNames != null && DateTime.UtcNow < _sourceNamesExpiryDate)
        {
            return _sourceNames;
        }
        for (var attempt = 1; attempt <= STYLE_FETCH_ATTEMPTS; attempt++)
        {
            try
            {
                var response = await _remoteFileFetcherGateway.GetFileContent(STYLE_ADDRESS);
                if (response.Content == null || response.Content.Length == 0)
                {
                    throw new InvalidOperationException("Got an empty style response");
                }
                _sourceNames = GetSourceNamesFromStyle(response.Content);
                _sourceNamesExpiryDate = DateTime.UtcNow.Add(STYLE_CACHE_DURATION);
                return _sourceNames;
            }
            catch (Exception ex)
            {
                _logger.LogWarning($"Failed to get the sources list from the style: {STYLE_ADDRESS}, attempt {attempt} of {STYLE_FETCH_ATTEMPTS}, error: {ex.Message}");
                if (attempt < STYLE_FETCH_ATTEMPTS)
                {
                    await Task.Delay(STYLE_FETCH_RETRY_DELAY);
                }
            }
        }
        if (_sourceNames != null)
        {
            _logger.LogWarning("Failed to get the sources list from the style, using the last known list");
            return _sourceNames;
        }
        throw new InvalidOperationException($"Unable to get the sources list from the style: {STYLE_ADDRESS}");
    }

    /// <summary>
    /// Extracts the sources names from a style's json content, a source name is the file name of its url, with or
    /// without an extension, for example: "https://mapeak.com/vector/data/mapeak-schema.json" translates to "mapeak-schema"
    /// and "https://mapeak.com/vector/data/raster-dem" translates to "raster-dem".
    /// </summary>
    private List<string> GetSourceNamesFromStyle(byte[] styleContent)
    {
        using var document = JsonDocument.Parse(styleContent);
        var names = new List<string>();
        foreach (var source in document.RootElement.GetProperty("sources").EnumerateObject())
        {
            if (!source.Value.TryGetProperty("url", out var urlElement))
            {
                _logger.LogWarning($"The source {source.Name} in the style has no url, ignoring it");
                continue;
            }
            var name = Path.GetFileNameWithoutExtension(urlElement.GetString() ?? string.Empty);
            if (string.IsNullOrWhiteSpace(name) || name.Contains(CONTOUR, StringComparison.OrdinalIgnoreCase))
            {
                continue;
            }
            names.Add(name);
        }
        names.Add(GLOBAL_POINTS);
        _logger.LogInformation("The offline files sources are: " + string.Join(", ", names));
        return names;
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

    /// <summary>
    /// Whether the given source or layer name is the DEM, either by its file name or by its alias.
    /// </summary>
    private static bool IsDem(string name)
    {
        return name is DEM_FILE_NAME or DEM_ALIAS_FILE_NAME;
    }

    /// <summary>
    /// Extracts the layer name from an offline file name, dropping the zoom/tile suffix.
    /// Tile files look like "name+7-x-y.pmtiles" and root files look like "name-6.pmtiles",
    /// where the layer name itself may contain '-'.
    /// </summary>
    private static string FileNameToSourceName(string fileName)
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

    private static string SourceNameToFileName(string sourceName, long? tileX, long? tileY)
    {
        return tileX.HasValue && tileY.HasValue
            ? $"{sourceName}+{SLICE_TILE_ZOOM}-{tileX}-{tileY}.pmtiles"
            : $"{sourceName}-{ROOT_ZOOM}.pmtiles";
    }
}
