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
    public string poiSource { get; set; }
    [JsonPropertyName("location")]
    public double[] Location { get; set; }
}