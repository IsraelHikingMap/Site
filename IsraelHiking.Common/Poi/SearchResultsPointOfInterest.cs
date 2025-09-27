using System.Text.Json.Serialization;

namespace IsraelHiking.Common.Poi;

public class SearchResultsPointOfInterest
{
    [JsonPropertyName("id")]
    public string Id { get; set; }
    [JsonPropertyName("source")]
    public string Source { get; set; }
    [JsonPropertyName("title")]
    public string Title { get; set; }
    [JsonPropertyName("displayName")]
    public string DisplayName { get; set; }
    [JsonPropertyName("icon")]
    public string Icon { get; set; }
    [JsonPropertyName("iconColor")]
    public string IconColor { get; set; }
    [JsonPropertyName("location")]
    public LatLng Location { get; set; }
    [JsonPropertyName("hasExtraData")]
    public bool HasExtraData { get; set; }
}