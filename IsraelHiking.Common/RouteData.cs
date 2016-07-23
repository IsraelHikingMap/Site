using System;
using System.Collections.Generic;

namespace IsraelHiking.Common
{
    public class RouteData
    {
        public string id { get; set; }
        public string name { get; set; }
        public List<RouteSegmentData> segments { get; set; }
        public List<MarkerData> markers { get; set; } 
        

        public RouteData()
        {
            id = Guid.NewGuid().ToString();
            segments = new List<RouteSegmentData>();
            markers = new List<MarkerData>();
            
        }
    }

    public class RouteDataOld
    {
        public string name { get; set; }
        public List<RouteSegmentDataOld> segments { get; set; }

        public RouteDataOld()
        {
            segments = new List<RouteSegmentDataOld>();
        }
    }
}