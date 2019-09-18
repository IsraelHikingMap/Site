namespace IsraelHiking.Common
{
    public class UpdateRequest
    {
        public bool OsmFile { get; set; }
        public bool Routing { get; set; }
        public bool PointsOfInterest { get; set; }
        public bool Highways { get; set; }
        public bool SiteMap { get; set; }
    }
}
