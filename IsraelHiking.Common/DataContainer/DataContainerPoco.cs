using System.Collections.Generic;
using System.Text.Json.Serialization;

namespace IsraelHiking.Common.DataContainer
{
    public class DataContainerPoco
    {
        [JsonPropertyName("routes")]
        public List<RouteData> Routes { get; set; }
        [JsonPropertyName("northEast")]
        public LatLng NorthEast { get; set; }
        [JsonPropertyName("southWest")]
        public LatLng SouthWest { get; set; }
        [JsonPropertyName("baseLayer")]
        public LayerData BaseLayer { get; set; }
        [JsonPropertyName("overlays")]
        public List<LayerData> Overlays { get; set; }

        public DataContainerPoco()
        {
            Routes = new List<RouteData>();
        }
    }
}
