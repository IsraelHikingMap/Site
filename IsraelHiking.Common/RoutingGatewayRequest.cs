namespace IsraelHiking.Common
{
    public enum ProfileType
    {
        None,
        Foot,
        Bike,
        Car,
    }

    public class RoutingGatewayRequest
    {
        public string From { get; set; }
        public string To { get; set; }
        public ProfileType Profile { get; set; }
    }
}
