using IsraelHiking.Common.DataContainer;
using NetTopologySuite.Features;

namespace IsraelHiking.Common.Poi
{
    public class PointOfInterestExtended : PointOfInterest
    {
        public bool IsEditable { get; set; }
        public bool IsRoute { get; set; }
        public bool IsArea { get; set; }
        public double LengthInKm { get; set; }
        public string Description { get; set; }
        public string ExternalDescription { get; set; }
        public string[] ImagesUrls { get; set; }

        public Reference[] References { get; set; }
        public FeatureCollection FeatureCollection { get; set; }
        public DataContainerPoco DataContainer { get; set; }
        public Contribution Contribution { get; set; }
        public NorthEast ItmCoordinates { get; set; }
    }
}
