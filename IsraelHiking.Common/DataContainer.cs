using System.Collections.Generic;

namespace IsraelHiking.Common
{
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
