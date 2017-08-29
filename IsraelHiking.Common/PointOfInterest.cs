using NetTopologySuite.Features;

namespace IsraelHiking.Common
{
    public class PointOfInterest
    {
        public string Id { get; set; }
        public string Category { get; set; }
        public string Title { get; set; }
        public LatLng Location { get; set; }
        public string Source { get; set; }
        public string Icon { get; set; }
        public string IconColor { get; set; }
    }

    public class PointOfInterestExtended : PointOfInterest
    {
        public FeatureCollection FeatureCollection { get; set; }
        public string ImageUrl { get; set; }
        public Rating Rating { get; set; }
        public string Url { get; set; }
        public string Description { get; set; }
        public bool IsEditable { get; set; }
    }
}
