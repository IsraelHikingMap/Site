using Newtonsoft.Json;
using System.Collections.Generic;

namespace IsraelHiking.Common.DataContainer
{
    public class DataContainerPoco
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

        public DataContainerPoco()
        {
            Routes = new List<RouteData>();
        }
    }
}
