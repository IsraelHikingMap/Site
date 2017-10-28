using Newtonsoft.Json;

namespace IsraelHiking.Common
{
    public class MarkerData
    {
        [JsonProperty("latlng")]
        public LatLng Latlng { get; set; }
        [JsonProperty("title")]
        public string Title { get; set; }
        [JsonProperty("type")]
        public string Type { get; set; }
    }
}