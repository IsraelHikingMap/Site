using System.Collections.Generic;

namespace IsraelHiking.Common
{
    public class DataContainer
    {
        public const string ISRAEL_HIKING_MAP = "IsraelHikingMap";

        public List<RouteData> routes { get; set; }
        public List<MarkerData> markers { get; set; }
        public LatLng northEast { get; set; }
        public LatLng southWest { get; set; }

        public DataContainer()
        {
            routes = new List<RouteData>();
            markers = new List<MarkerData>();
        }
    }
}
