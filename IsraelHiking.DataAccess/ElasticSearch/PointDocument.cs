using System.Collections.Generic;
using System.Text.Json.Serialization;

public class PointDocument
{
    [JsonPropertyName("name")]
    public Dictionary<string, string> Name { get; set; }
    [JsonPropertyName("description")]
    public Dictionary<string, string> Description { get; set; }
    [JsonPropertyName("poiCategory")]
    public string PoiCategory { get; set; }
    [JsonPropertyName("poiIcon")]
    public string PoiIcon { get; set; }
    [JsonPropertyName("poiIconColor")]
    public string PoiIconColor { get; set; }
    [JsonPropertyName("poiSource")]
    public string PoiSource { get; set; }
    [JsonPropertyName("image")]
    public string Image { get; set; }
    [JsonPropertyName("location")]
    public double[] Location { get; set; }
    [JsonPropertyName("poiProminence")]
    public float? Prominence { get; set; }
    /// <summary>The tightest enclosing place, per language.</summary>
    [JsonPropertyName("poiContainer")]
    public Dictionary<string, string> PoiContainer { get; set; }
    /// <summary>The enclosing country, per language.</summary>
    [JsonPropertyName("poiCountry")]
    public Dictionary<string, string> PoiCountry { get; set; }
}