using NetTopologySuite.Geometries;

namespace IsraelHiking.Common.Api
{
    public enum ProfileType
    {
        None,
        Foot,
        Bike,
        Car4WheelDrive,
        Car
    }

    public class RoutingGatewayRequest
    {
        public Coordinate From { get; set; }
        public Coordinate To { get; set; }
        public ProfileType Profile { get; set; }
    }
}
