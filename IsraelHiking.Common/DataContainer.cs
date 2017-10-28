using System.Collections.Generic;
using Newtonsoft.Json;

namespace IsraelHiking.Common
{
    public class DataContainer
    {
        [JsonProperty("routes")]
        public List<RouteData> Routes { get; set; }
        [JsonProperty("northEast")]
        public LatLng NorthEast { get; set; }
        [JsonProperty("southWest")]
        public LatLng SouthWest { get; set; }
        [JsonProperty("baseLayer")]
        public LayerData BaseLayer { get; set; }
        [JsonProperty("overlays")]
        public List<LayerData> Overlays { get; set; }

        public DataContainer()
        {
            Routes = new List<RouteData>();
        }
    }
}
