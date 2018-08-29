using System.Collections.Generic;
using Newtonsoft.Json;

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
        [JsonProperty("routingType")]
        public string RoutingType { get; set; }
        [JsonProperty("routePoint")]
        public LatLng RoutePoint { get; set; }
        [JsonProperty("latlngs")]
        public List<LatLngTime> Latlngs { get; set; }
        
        public RouteSegmentData()
        {
            Latlngs = new List<LatLngTime>();
        }
    }
}