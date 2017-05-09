using System.Collections.Generic;

namespace IsraelHiking.Common
{
    public static class RoutingType
    {
        public const string HIKE = "Hike";
        public const string BIKE = "Bike";
        public const string FOUR_WHEEL_DRIVE = "4WD";
        public const string NONE = "None";
    }

    public class RouteSegmentData
    {
        public LatLng routePoint { get; set; }
        public List<LatLng> latlngs { get; set; }
        public string routingType { get; set; }

        public RouteSegmentData()
        {
            latlngs = new List<LatLng>();
        }
    }
}