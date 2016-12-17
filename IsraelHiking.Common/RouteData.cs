using System.Collections.Generic;

namespace IsraelHiking.Common
{
    public class RouteData
    {
        public string name { get; set; }
        public List<MarkerData> markers { get; set; }
        public List<RouteSegmentData> segments { get; set; }

        public RouteData()
        {
            markers = new List<MarkerData>();
            segments = new List<RouteSegmentData>();
        }
    }
}