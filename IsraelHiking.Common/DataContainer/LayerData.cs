using Newtonsoft.Json;

namespace IsraelHiking.Common.DataContainer
{
    public class LayerData
    {
        [JsonProperty("key")]
        public string Key { get; set; }
        [JsonProperty("address")]
        public string Address { get; set; }
        [JsonProperty("minZoom")]
        public int? MinZoom { get; set; }
        [JsonProperty("maxZoom")]
        public int? MaxZoom { get; set; }
        [JsonProperty("opacity")]
        public double? Opacity { get; set; }
    }
}