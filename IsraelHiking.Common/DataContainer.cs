using System.Collections.Generic;

namespace IsraelHiking.Common
{
    public class LayerData
    {
        public string key { get; set; }
        public string address { get; set; }
        public int? minZoom { get; set; }
        public int? maxZoom { get; set; }
    }

    public class DataContainer
    {
        public List<RouteData> routes { get; set; }
        public LatLng northEast { get; set; }
        public LatLng southWest { get; set; }
        public LayerData baseLayer { get; set; }
        public List<LayerData> overlays { get; set; }

        public DataContainer()
        {
            routes = new List<RouteData>();
        }
    }
}
