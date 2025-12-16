namespace IsraelHiking.Common.Api;

public enum SimplePointType
{
    None,
    Tap,
    CattleGrid,
    Parking,
    OpenGate,
    ClosedGate,
    Block,
    PicnicSite,
    Bench
}

public class AddSimplePointOfInterestRequest
{
    public string Guid {get;set;}
    public LatLng LatLng { get; set; }
    public SimplePointType PointType { get;set;}
}