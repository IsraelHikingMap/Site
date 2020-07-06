namespace IsraelHiking.Common.Api
{
    public enum SimplePointType
    {
        None,
        Tap,
        CattleGrid,
        Parking,
        OpenGate,
        ClosedGate,
        Bollards
    }

    public class AddSimplePointOfInterestRequest
    {
        public LatLng LatLng { get; set; }
        public SimplePointType PointType { get;set;}
    }
}