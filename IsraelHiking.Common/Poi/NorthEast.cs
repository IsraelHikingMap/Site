using System.Text.Json.Serialization;

namespace IsraelHiking.Common.Poi;

/// <summary>
/// Return value for elevation request
/// </summary>
public class NorthEast
{
    /// <summary>
    /// North coordinates in meters
    /// </summary>
    [JsonPropertyName("north")]
    public int North { get; set; }
    /// <summary>
    /// East coordinates in meters
    /// </summary>
    [JsonPropertyName("east")]
    public int East { get; set; }
}