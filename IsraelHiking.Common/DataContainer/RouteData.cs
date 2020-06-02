using Newtonsoft.Json;
using System.Collections.Generic;

namespace IsraelHiking.Common.DataContainer
{
    public class RouteData
    {
        [JsonProperty("name")]
        public string Name { get; set; }
        [JsonProperty("description")]
        public string Description { get; set; }
        [JsonProperty("color")]
        public string Color { get; set; }
        [JsonProperty("opacity")]
        public double? Opacity { get; set; }
        [JsonProperty("weight")]
        public int? Weight { get; set; }
        [JsonProperty("markers")]
        public List<MarkerData> Markers { get; set; }
        [JsonProperty("segments")]
        public List<RouteSegmentData> Segments { get; set; }

        public RouteData()
        {
            Markers = new List<MarkerData>();
            Segments = new List<RouteSegmentData>();
        }
    }
}