using IsraelHiking.Common.Configuration;
using IsraelHiking.Common.Extensions;
using IsraelHiking.DataAccessInterfaces;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using NetTopologySuite.Features;
using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.Globalization;
using System.IO;
using System.Linq;
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
    /// The zoom level up to which the root files that are listed along with an area hold the whole world. It is
    /// kept low so they stay small enough to be downloaded with every area, which holds the zooms above it.
    /// </summary>
    private const int ROOT_ZOOM = 4;

    /// <summary>
    /// The zoom level up to which the root files of the apps that download tiles hold the whole world, their
    /// tiles start at the zoom after it.
    /// </summary>
    private const int TILES_ROOT_ZOOM = SLICE_TILE_ZOOM - 1;

    /// <summary>
    /// The id the root files that are listed along with an area are named by, the one the client keeps them under.
    /// </summary>
    private const string ROOT_KEY = "root";

    /// <summary>
    /// The zoom level the files of an area start at, where the root files end.
    /// </summary>
    private const int AREA_MIN_ZOOM = ROOT_ZOOM + 1;

    /// <summary>
    /// The location of the styles the map is drawn with, which the client reads them from by itself.
    /// </summary>
    private const string STYLES_ADDRESS = "https://mapeak.com/styles/";

    private const string HIKE_STYLE_FILE_NAME = "mapeak-hike.json";

    /// <summary>
    /// The style that defines which sources (i.e. offline files) the client needs.
    /// </summary>
    private const string STYLE_ADDRESS = STYLES_ADDRESS + HIKE_STYLE_FILE_NAME;

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
    /// The DEM, which is sliced on the fly by its own service. It only exists at the tile level.
    /// </summary>
    private const string DEM_FILE_NAME = "raster-dem";

    /// <summary>
    /// The offline routing (valhalla) tiles of a slice, a gzipped tar that is sliced on the fly like the
    /// other files - the client unpacks it. An area gets it as a plain tar instead, which starts
    /// streaming immediately with its exact size. It is not a part of the style, and it is only listed for
    /// clients that ask for it since older clients do not know how to handle it.
    /// It is the largest file of a tile and the slowest one to generate, which is why it is listed first.
    /// </summary>
    private const string VALHALLA_FILE_NAME = "valhalla";

    /// <inheritdoc cref="VALHALLA_FILE_NAME"/>
    private const string VALHALLA_FILE_EXTENSION = ".tgz";

    /// <inheritdoc cref="VALHALLA_FILE_NAME"/>
    private const string VALHALLA_TAR_FILE_EXTENSION = ".tar";

    /// <summary>
    /// The routing profiles (costing options) the client routes offline with, the same file this server routes
    /// with, so that a route that is calculated offline is the same one that is calculated online. It is not sliced,
    /// so it is listed with the root files, and like the routing tiles only for clients that know how to handle it.
    /// </summary>
    private const string VALHALLA_PROFILES_FILE_NAME = "valhalla-profiles.json";

    /// <summary>
    /// The fixed last modified date reported for the DEM, bumped whenever the underlying data changes.
    /// </summary>
    private static readonly DateTime DEM_MODIFIED_DATE = DateTimeOffset.Parse("2026-11-07T00:00:00Z", CultureInfo.InvariantCulture).UtcDateTime;

    private static readonly JsonSerializerOptions GEO_JSON_OPTIONS = new() { Converters = { GeoJsonExtensions.GeoJsonWritableFactory } };

    private readonly IRemoteFileFetcherGateway _remoteFileFetcherGateway;
    private readonly ILogger _logger;
    private readonly ConfigurationData _options;
    private List<string> _sourceNames;
    private DateTime _sourceNamesExpiryDate = DateTime.MinValue;

    /// <summary>
    /// Constructor
    /// </summary>
    /// <param name="remoteFileFetcherGateway"></param>
    /// <param name="options"></param>
    /// <param name="logger"></param>
    public OfflineFilesService(IRemoteFileFetcherGateway remoteFileFetcherGateway,
        IOptions<ConfigurationData> options,
        ILogger logger)
    {
        _remoteFileFetcherGateway = remoteFileFetcherGateway;
        _logger = logger;
        _options = options.Value;
    }

    /// <inheritdoc/>
    /// <remarks>
    /// The on-the-fly files are generated on demand, so they are always reported with today's date,
    /// while the DEM file has a fixed date and only exists at the tile level.
    /// The routing tiles are by far the largest and the slowest file of a tile, which is why they are
    /// listed before everything else.
    /// </remarks>
    public async Task<Dictionary<string, DateTime>> GetUpdatedFilesList(DateTime lastModifiedDate, long? tileX, long? tileY, bool routingTile)
    {
        var filesDictionary = new Dictionary<string, DateTime>();
        var today = DateTime.UtcNow.Date;
        if (routingTile && tileX.HasValue && tileY.HasValue)
        {
            AddIfUpdated(filesDictionary, SourceNameToFileName(VALHALLA_FILE_NAME, tileX, tileY, VALHALLA_FILE_EXTENSION), today, lastModifiedDate);
        }
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
        if (routingTile && !tileX.HasValue && !tileY.HasValue)
        {
            AddIfUpdated(filesDictionary, VALHALLA_PROFILES_FILE_NAME, today, lastModifiedDate);
        }
        return filesDictionary;
    }

    /// <inheritdoc/>
    /// <remarks>
    /// The valhalla profiles are read from this server's own files, the routing tiles and the DEM are served by
    /// their own services, and everything else by the on-the-fly one.
    /// </remarks>
    public async Task<(Stream Content, long? Length)> GetFileContent(string fileName, long? tileX, long? tileY)
    {
        // The files that are not per tile are named by themselves and not by a source, so they are matched first.
        if (fileName == VALHALLA_PROFILES_FILE_NAME)
        {
            return OpenLocalFile(_options.ValhallaProfilesFilePath);
        }
        var sourceName = FileNameToSourceName(fileName);
        if (sourceName == VALHALLA_FILE_NAME)
        {
            return await _remoteFileFetcherGateway.GetFileStream(_options.RoutingTilesAddress + fileName);
        }
        if (IsDem(sourceName))
        {
            return await _remoteFileFetcherGateway.GetFileStream(_options.OnTheFlyDemAddress + fileName);
        }
        return await _remoteFileFetcherGateway.GetFileStream(_options.OnTheFlyFilesAddress + fileName);
    }

    /// <inheritdoc/>
    /// <remarks>
    /// The routing tiles are listed first, as the largest and slowest file, then the files of the area and then the
    /// root files that come with every area. The global points have no root file, they hold nothing at its zooms.
    /// Every file is named the way the client keeps it, so the root files are named by <see cref="ROOT_KEY"/>.
    /// </remarks>
    public async Task<Dictionary<string, DateTime>> GetUpdatedFilesListForArea(string areaId, DateTime lastModifiedDate)
    {
        if (await GetAreaGeometry(areaId) == null)
        {
            return null;
        }
        var filesDictionary = new Dictionary<string, DateTime>();
        var today = DateTime.UtcNow.Date;
        AddIfUpdated(filesDictionary, $"{VALHALLA_FILE_NAME}+{areaId}{VALHALLA_TAR_FILE_EXTENSION}", today, lastModifiedDate);
        var sourceNames = await GetSourceNames();
        foreach (var name in sourceNames)
        {
            AddIfUpdated(filesDictionary, $"{name}+{areaId}.pmtiles", IsDem(name) ? DEM_MODIFIED_DATE : today, lastModifiedDate);
        }
        foreach (var name in sourceNames.Where(name => !IsDem(name) && name != GLOBAL_POINTS))
        {
            AddIfUpdated(filesDictionary, $"{name}+{ROOT_KEY}.pmtiles", today, lastModifiedDate);
        }
        AddIfUpdated(filesDictionary, VALHALLA_PROFILES_FILE_NAME, today, lastModifiedDate);
        return filesDictionary;
    }

    /// <inheritdoc/>
    /// <remarks>
    /// The polygon of the area is posted to the service that slices the file, since the larger ones are too long for a url.
    /// The root files are the zoom <see cref="ROOT_ZOOM"/> files of the whole world, and the profiles are this server's own file.
    /// </remarks>
    public async Task<(Stream Content, long? Length)?> GetFileContentForArea(string areaId, string fileName)
    {
        var geometry = await GetAreaGeometry(areaId);
        if (geometry == null)
        {
            return null;
        }
        if (fileName == VALHALLA_PROFILES_FILE_NAME)
        {
            return OpenLocalFile(_options.ValhallaProfilesFilePath);
        }
        var sourceName = FileNameToSourceName(fileName);
        if (sourceName == VALHALLA_FILE_NAME)
        {
            return await PostForSlice($"{_options.RoutingTilesAddress}{VALHALLA_FILE_NAME}{VALHALLA_TAR_FILE_EXTENSION}", geometry, fileName);
        }
        if (!(await GetSourceNames()).Contains(sourceName))
        {
            return null;
        }
        if (fileName == $"{sourceName}+{ROOT_KEY}.pmtiles")
        {
            return await _remoteFileFetcherGateway.GetFileStream($"{_options.OnTheFlyFilesAddress}{sourceName}-{ROOT_ZOOM}.pmtiles");
        }
        var address = IsDem(sourceName) ? _options.OnTheFlyDemAddress : _options.OnTheFlyFilesAddress;
        return await PostForSlice($"{address}{sourceName}?minzoom={AREA_MIN_ZOOM}", geometry, fileName);
    }

    /// <summary>
    /// Posts the polygon of an area to a service that slices a file by it, and logs how long the slicing took, which is the
    /// time until the response starts, before its body is streamed to the client.
    /// </summary>
    private async Task<(Stream Content, long? Length)> PostForSlice(string url, string geometry, string fileName)
    {
        var stopwatch = Stopwatch.StartNew();
        var result = await _remoteFileFetcherGateway.PostForFileStream(url, geometry);
        _logger.LogInformation($"Sliced {fileName} in {stopwatch.ElapsedMilliseconds} ms, {result.Length?.ToString() ?? "unknown"} bytes");
        return result;
    }

    /// <inheritdoc/>
    public Stream GetAreasContent()
    {
        return OpenLocalFile(_options.OfflineAreasFilePath).Content;
    }

    /// <summary>
    /// The GeoJSON geometry of one of the areas, null when there is no such area. The file is read every time,
    /// since it can be replaced while the site is running.
    /// </summary>
    private async Task<string> GetAreaGeometry(string areaId)
    {
        await using var content = GetAreasContent();
        var areas = await JsonSerializer.DeserializeAsync<FeatureCollection>(content, GEO_JSON_OPTIONS);
        var area = areas.FirstOrDefault(feature => feature.Attributes.GetOptionalValue("id") as string == areaId);
        return area == null ? null : JsonSerializer.Serialize(area.Geometry, GEO_JSON_OPTIONS);
    }

    /// <summary>
    /// Opens a file this server holds, which is not a part of the offline files folder, in order to serve it.
    /// </summary>
    private static (Stream Content, long? Length) OpenLocalFile(string path)
    {
        var fileInfo = new FileInfo(path);
        return (fileInfo.OpenRead(), fileInfo.Length);
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
    /// Whether the given source or layer name is the DEM.
    /// </summary>
    private static bool IsDem(string name)
    {
        return name == DEM_FILE_NAME;
    }

    /// <summary>
    /// Extracts the layer name from an offline file name, dropping what follows it.
    /// The files of an area look like "name+id.pmtiles", the tiles like "name+7-x-y.pmtiles" and their root
    /// files like "name-6.pmtiles", where the layer name itself may contain '-'.
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

    private static string SourceNameToFileName(string sourceName, long? tileX, long? tileY, string extension = ".pmtiles")
    {
        return tileX.HasValue && tileY.HasValue
            ? $"{sourceName}+{SLICE_TILE_ZOOM}-{tileX}-{tileY}{extension}"
            : $"{sourceName}-{TILES_ROOT_ZOOM}{extension}";
    }
}
