using System;
using System.Collections.Generic;
using System.IO;
using System.Text.Json;
using System.Text.Json.Serialization;
using IsraelHiking.Common.Api;
using IsraelHiking.Common.Configuration;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;

namespace IsraelHiking.DataAccess;

/// <summary>
/// A single Valhalla routing profile, as defined in the profiles file
/// </summary>
public class ValhallaProfile
{
    /// <summary>
    /// The Valhalla costing model, i.e. "pedestrian", "bicycle", "auto"
    /// </summary>
    [JsonPropertyName("costing")]
    public string Costing { get; set; }

    /// <summary>
    /// Free-form Valhalla costing options, they are sent to Valhalla as-is under the costing name, so any
    /// option Valhalla supports can be set without changing the code, see
    /// https://valhalla.github.io/valhalla/api/turn-by-turn/api-reference/#costing-options
    /// </summary>
    [JsonPropertyName("costingOptions")]
    public JsonElement? CostingOptions { get; set; }
}

/// <summary>
/// Provides the Valhalla routing profiles from a JSON file which can be mounted into the container,
/// this allows tuning the routing behavior without rebuilding the site.
/// The file is read again whenever it changes on disk, so a restart is not needed.
/// </summary>
public class ValhallaProfilesProvider(IOptions<ConfigurationData> options, ILogger logger)
{
    /// <summary>
    /// The profile used when the requested profile is not defined in the file
    /// </summary>
    private const string DefaultProfileKey = "default";

    private static readonly JsonSerializerOptions JsonOptions = new()
    {
        PropertyNameCaseInsensitive = true,
        ReadCommentHandling = JsonCommentHandling.Skip,
        AllowTrailingCommas = true
    };

    /// <summary>
    /// Used when the file is missing or invalid, so that routing keeps working using Valhalla's own defaults
    /// </summary>
    private static readonly ValhallaProfile FallbackProfile = new() { Costing = "pedestrian" };

    private readonly ConfigurationData _options = options.Value;
    private readonly ILogger _logger = logger;
    private readonly object _syncRoot = new();

    private Dictionary<string, ValhallaProfile> _profiles;
    private DateTime _lastWriteTimeUtc;

    /// <summary>
    /// Gets the profile definition for the given profile type
    /// </summary>
    /// <param name="profileType">The requested profile</param>
    /// <returns>The profile definition, never null</returns>
    public ValhallaProfile GetProfile(ProfileType profileType)
    {
        var profiles = GetProfiles();
        var profile = GetProfileByKey(profiles, profileType.ToString()) ?? GetProfileByKey(profiles, DefaultProfileKey);
        return profile ?? FallbackProfile;
    }

    private static ValhallaProfile GetProfileByKey(Dictionary<string, ValhallaProfile> profiles, string key)
    {
        return profiles.TryGetValue(key, out var profile) && !string.IsNullOrWhiteSpace(profile?.Costing)
            ? profile
            : null;
    }

    private Dictionary<string, ValhallaProfile> GetProfiles()
    {
        var filePath = _options.ValhallaProfilesFilePath;
        var lastWriteTimeUtc = File.Exists(filePath) ? File.GetLastWriteTimeUtc(filePath) : DateTime.MinValue;
        lock (_syncRoot)
        {
            if (_profiles != null && _lastWriteTimeUtc == lastWriteTimeUtc)
            {
                return _profiles;
            }
            _profiles = ReadProfiles(filePath);
            _lastWriteTimeUtc = lastWriteTimeUtc;
            return _profiles;
        }
    }

    private Dictionary<string, ValhallaProfile> ReadProfiles(string filePath)
    {
        try
        {
            var content = File.ReadAllText(filePath);
            var profiles = JsonSerializer.Deserialize<Dictionary<string, ValhallaProfile>>(content, JsonOptions)
                ?? throw new InvalidOperationException("The file is empty");
            _logger.LogInformation($"Loaded {profiles.Count} Valhalla profiles from {filePath}");
            return new Dictionary<string, ValhallaProfile>(profiles, StringComparer.OrdinalIgnoreCase);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, $"Failed to read the Valhalla profiles from {filePath}, falling back to Valhalla's default costing options");
            return [];
        }
    }
}
