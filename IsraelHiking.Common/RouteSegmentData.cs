using System.Collections.Generic;

namespace IsraelHiking.Common
{
    public class RouteSegmentData
    {
        public LatLng routePoint { get; set; }
        public List<LatLngZ> latlngzs { get; set; }
        public string routingType { get; set; }

        public RouteSegmentData()
        {
            latlngzs = new List<LatLngZ>();
        }
    }
}