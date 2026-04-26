using System.Text.Json.Serialization;

namespace IsraelHiking.Common.Poi;

public class RoutePoiItem
{
    [JsonPropertyName("poi")]
    public SearchResultsPointOfInterest Poi { get; set; }

    [JsonPropertyName("distanceFromStartKm")]
    public double DistanceFromStartKm { get; set; }

    [JsonPropertyName("distanceFromRouteMeters")]
    public double DistanceFromRouteMeters { get; set; }

    [JsonPropertyName("description")]
    public string Description { get; set; }
}
