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
        Block,
        PicnicSite
    }

    public class AddSimplePointOfInterestRequest
    {
        public LatLng LatLng { get; set; }
        public SimplePointType PointType { get;set;}
    }
}