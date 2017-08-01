using System.Collections.Generic;

namespace IsraelHiking.Common
{
    public class RouteData
    {
        public string name { get; set; }
        public string description { get; set; }
        public string color { get; set; }
        public double? opacity { get; set; }
        public int? weight { get; set; }
        public List<MarkerData> markers { get; set; }
        public List<RouteSegmentData> segments { get; set; }

        public RouteData()
        {
            markers = new List<MarkerData>();
            segments = new List<RouteSegmentData>();
        }
    }
}