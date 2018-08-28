using System;
using System.Collections.Generic;
using System.Text;
using NetTopologySuite.IO;

namespace IsraelHiking.API.Gpx
{
    // HM TODO: Should be removed when the following issue will be solved:
    // https://github.com/NetTopologySuite/NetTopologySuite.IO.GPX/issues/12
    /// <summary>
    /// A class that holds all the data related to Gpx file.
    /// </summary>
    public class GpxMainObject
    {
        public List<GpxRoute> Routes { get; set; }
        public List<GpxTrack> Tracks { get; set; }
        public List<GpxWaypoint> Waypoints { get; set; }
        public GpxMetadata Metadata { get; set; }

        public GpxMainObject()
        {
            Routes = new List<GpxRoute>();
            Tracks = new List<GpxTrack>();
            Waypoints = new List<GpxWaypoint>();
            Metadata = new GpxMetadata("");
        }
    }
}
