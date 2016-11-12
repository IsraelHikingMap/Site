using System.Collections.Generic;

namespace IsraelHiking.Common
{
    public class RouteData
    {
        public string name { get; set; }
        public List<RouteSegmentData> segments { get; set; }

        public RouteData()
        {
            segments = new List<RouteSegmentData>();
        }
    }
}