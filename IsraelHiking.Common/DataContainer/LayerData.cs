using System.Text.Json.Serialization;

namespace IsraelHiking.Common.DataContainer
{
    public class LayerData
    {
        [JsonPropertyName("key")]
        public string Key { get; set; }
        [JsonPropertyName("address")]
        public string Address { get; set; }
        [JsonPropertyName("minZoom")]
        public int? MinZoom { get; set; }
        [JsonPropertyName("maxZoom")]
        public int? MaxZoom { get; set; }
        [JsonPropertyName("opacity")]
        public double? Opacity { get; set; }
    }
}