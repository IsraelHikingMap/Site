using System;
using System.Collections.Generic;

namespace IsraelHiking.Common
{
    // HM TODO: add this to OsmSharp
    // This is temporary until added there.
    public class OsmTrace
    {
        public string Id { get; set; }
        public LatLng LatLng { get; set; }
        public string Description { get; set; }
        public string Name { get; set; }
        public string UserName { get; set; }
        public string Visibility { get; set; }
        public DateTime Date { get; set; }
        public List<string> Tags { get; set; }

        public OsmTrace()
        {
            Tags = new List<string>();
        }
    }
}
