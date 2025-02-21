using System.Text.Json.Serialization;
using System.Collections.Generic;

namespace IsraelHiking.Common.DataContainer;

public class RouteData
{
    [JsonPropertyName("id")]
    public string Id { get; set; }
        
    [JsonPropertyName("name")]
    public string Name { get; set; }
    [JsonPropertyName("description")]
    public string Description { get; set; }
    [JsonPropertyName("color")]
    public string Color { get; set; }
    [JsonPropertyName("opacity")]
    public double? Opacity { get; set; }
    [JsonPropertyName("weight")]
    public int? Weight { get; set; }
    [JsonPropertyName("markers")]
    public List<MarkerData> Markers { get; set; }
    [JsonPropertyName("segments")]
    public List<RouteSegmentData> Segments { get; set; }

    public RouteData()
    {
        Markers = [];
        Segments = [];
    }
}