using System.Collections.Generic;
using System.Text.Json.Serialization;

public class BBoxContainer
{
    [JsonPropertyName("coordinates")]
    public double[][] Coordinates { get; set; }
}

public class BBoxDocument
{
    [JsonPropertyName("name")]
    public Dictionary<string, string> Name { get; set; }
    [JsonPropertyName("area")]
    public double Area { get; set; }
    [JsonPropertyName("bbox")]
    public BBoxContainer BBox { get; set; }
}