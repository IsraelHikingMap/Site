namespace IsraelHiking.Common.Poi
{
    public class PointOfInterest
    {
        public string Id { get; set; }
        public string Category { get; set; }
        public string Title { get; set; }
        public string Source { get; set; }
        public string Icon { get; set; }
        public string IconColor { get; set; }
        public bool HasExtraData { get; set; }

        public LatLng Location { get; set; }
    }
}
