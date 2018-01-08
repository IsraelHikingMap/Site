using System.Collections.Generic;
using Newtonsoft.Json;

namespace IsraelHiking.Common
{
    public class MarkerData
    {
        [JsonProperty("latlng")]
        public LatLng Latlng { get; set; }
        [JsonProperty("title")]
        public string Title { get; set; }
        [JsonProperty("description")]
        public string Description { get; set; }
        [JsonProperty("type")]
        public string Type { get; set; }
        [JsonProperty("urls")]
        public List<LinkData> Urls { get; set; }

        public MarkerData()
        {
            Urls = new List<LinkData>();
        }
    }
}