namespace IsraelHiking.Common
{
    public class PointOfInterest
    {
        public string Id { get; set; }
        public string Type { get; set; }
        public string Category { get; set; }
        public string Title { get; set; }
        public string Source { get; set; }
        public string Icon { get; set; }
        public string IconColor { get; set; }

        public LatLng Location { get; set; }
    }

    public class Reference
    {
        public string Url { get; set; }
        public string SourceImageUrl { get; set; }
    }

    public class PointOfInterestExtended : PointOfInterest
    {
        public bool IsEditable { get; set; }
        public bool IsRoute { get; set; }
        public bool IsArea { get; set; }
        public string Description { get; set; }
        public string[] ImagesUrls { get; set; }

        public Reference[] References { get; set; }
        public Rating Rating { get; set; }
        public DataContainer DataContainer { get; set; }
    }
}
