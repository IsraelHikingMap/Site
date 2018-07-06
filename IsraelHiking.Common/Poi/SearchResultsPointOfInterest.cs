namespace IsraelHiking.Common.Poi
{
    public class SearchResultsPointOfInterest : PointOfInterestExtended
    {
        public string DisplayName { get; set; }
        public LatLng NorthEast { get; set; }
        public LatLng SouthWest { get; set; }
    }
}
