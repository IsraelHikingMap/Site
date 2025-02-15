using System.Text.Json.Serialization;
using System.Collections.Generic;

namespace IsraelHiking.Common.DataContainer;

public class MarkerData
{
    [JsonPropertyName("latlng")]
    public LatLng Latlng { get; set; }
    [JsonPropertyName("title")]
    public string Title { get; set; }
    [JsonPropertyName("description")]
    public string Description { get; set; }
    [JsonPropertyName("type")]
    public string Type { get; set; }
    [JsonPropertyName("urls")]
    public List<LinkData> Urls { get; set; }

    public MarkerData()
    {
        Urls = [];
    }
}