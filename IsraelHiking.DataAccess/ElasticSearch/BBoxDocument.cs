using System.Collections.Generic;
using System.Text.Json.Serialization;

namespace IsraelHiking.DataAccess.ElasticSearch;

public class BaseBBoxShape
{
    [JsonPropertyName("type")]
    public string Type { get; set; }
}

public class MultiPolygonBBoxShape : BaseBBoxShape {
    [JsonPropertyName("coordinates")]
    public double[][][][] Coordinates { get; set; }
}

public class PolygonBBoxShape : BaseBBoxShape {
    [JsonPropertyName("coordinates")]
    public double[][][] Coordinates { get; set; }
}

public class EnvelopeBBoxShape : BaseBBoxShape {
    [JsonPropertyName("coordinates")]
    public double[][] Coordinates { get; set; }
}

public class BBoxDocument
{
    [JsonPropertyName("name")]
    public Dictionary<string, string> Name { get; set; }
    [JsonPropertyName("area")]
    public double Area { get; set; }
    [JsonConverter(typeof(BBoxShapeGeoJsonConverter))]
    [JsonPropertyName("bbox")]
    public BaseBBoxShape BBox { get; set; }
}