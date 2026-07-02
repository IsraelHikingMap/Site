using System.Net.Http;
using System.Threading.Tasks;
using IsraelHiking.Common.Api;
using IsraelHiking.Common.Configuration;
using IsraelHiking.DataAccessInterfaces;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using NetTopologySuite.Features;
using System.Text.Json.Serialization;
using System.Collections.Generic;
using System.Text;
using System.Text.Json;
using System;
using System.Linq;
using NetTopologySuite.Geometries;

namespace IsraelHiking.DataAccess;

class ValhallaRequest
{
    [JsonPropertyName("locations")]
    public List<ValhallaLocation> Locations { get; set; }

    [JsonPropertyName("costing")]
    public string Costing { get; set; }

    [JsonPropertyName("units")]
    public string Units { get; set; }
    [JsonPropertyName("elevation_interval")]
    public double? ElevationInterval { get; set; }
}

public class ValhallaResponse
{
    [JsonPropertyName("id")]
    public string Id { get; set; }

    [JsonPropertyName("trip")]
    public ValhallaTrip Trip { get; set; }
}

public class ValhallaTrip
{
    [JsonPropertyName("status")]
    public int Status { get; set; }

    [JsonPropertyName("status_message")]
    public string StatusMessage { get; set; }

    [JsonPropertyName("units")]
    public string Units { get; set; }

    [JsonPropertyName("legs")]
    public List<ValhallaLeg> Legs { get; set; }

    [JsonPropertyName("summary")]
    public ValhallaSummary Summary { get; set; }

    [JsonPropertyName("locations")]
    public List<ValhallaLocation> Locations { get; set; }
}

public class ValhallaLeg
{
    // This is the 6-precision encoded polyline string you need
    [JsonPropertyName("shape")]
    public string Shape { get; set; }
    [JsonPropertyName("elevation")]
    public List<double> Elevation { get; set; }

    [JsonPropertyName("summary")]
    public ValhallaSummary Summary { get; set; }

    [JsonPropertyName("maneuvers")]
    public List<ValhallaManeuver> Maneuvers { get; set; }
}

public class ValhallaSummary
{
    [JsonPropertyName("time")]
    public double Time { get; set; } // In seconds

    [JsonPropertyName("length")]
    public double Length { get; set; } // In configured units (miles/km)
}

public class ValhallaLocation
{
    [JsonPropertyName("lat")]
    public double Lat { get; set; }

    [JsonPropertyName("lon")]
    public double Lon { get; set; }

    [JsonPropertyName("type")]
    public string Type { get; set; } // e.g., "break"
}

public class ValhallaManeuver
{
    [JsonPropertyName("type")]
    public int Type { get; set; }

    [JsonPropertyName("instruction")]
    public string Instruction { get; set; }

    [JsonPropertyName("verbal_pre_transition_instruction")]
    public string VerbalPreTransitionInstruction { get; set; }

    [JsonPropertyName("street_names")]
    public List<string> StreetNames { get; set; }

    [JsonPropertyName("length")]
    public double Length { get; set; } // In configured units (km here)

    [JsonPropertyName("time")]
    public double Time { get; set; } // In seconds

    [JsonPropertyName("begin_shape_index")]
    public int BeginShapeIndex { get; set; }

    [JsonPropertyName("end_shape_index")]
    public int EndShapeIndex { get; set; }

    [JsonPropertyName("roundabout_exit_count")]
    public int RoundaboutExitCount { get; set; }
}

/// <summary>Valhalla trace_route (map matching) request.</summary>
class ValhallaTraceRouteRequest
{
    [JsonPropertyName("shape")]
    public List<ValhallaLocation> Shape { get; set; }

    [JsonPropertyName("costing")]
    public string Costing { get; set; }

    [JsonPropertyName("shape_match")]
    public string ShapeMatch { get; set; }

    [JsonPropertyName("directions_options")]
    public ValhallaDirectionsOptions DirectionsOptions { get; set; }
}

class ValhallaDirectionsOptions
{
    [JsonPropertyName("language")]
    public string Language { get; set; }

    [JsonPropertyName("units")]
    public string Units { get; set; }
}

/// <summary>
/// GraphHopper-compatible instruction, kept so already-shipped clients (Android Auto / CarPlay) that
/// read the GraphHopper shape keep working after the routing engine was switched to Valhalla.
/// </summary>
class GraphHopperCompatibleInstruction
{
    [JsonPropertyName("text")]
    public string Text { get; set; }

    [JsonPropertyName("distance")]
    public double Distance { get; set; } // In meters

    [JsonPropertyName("sign")]
    public int Sign { get; set; }

    [JsonPropertyName("interval")]
    public int[] Interval { get; set; }

    [JsonPropertyName("exit_number")]
    public int? ExitNumber { get; set; }

    [JsonPropertyName("turn_angle")]
    public double? TurnAngle { get; set; }
}

public class ValhallaGateway(IHttpClientFactory httpClientFactory,
    IOptions<ConfigurationData> options,
    ILogger logger) : IRoutingGateway
{
    private readonly IHttpClientFactory _httpClientFactory = httpClientFactory;
    private readonly ConfigurationData _options = options.Value;
    private readonly ILogger _logger = logger;

    public async Task<Feature> GetRouting(RoutingGatewayRequest request)
    {
        var httpClient = _httpClientFactory.CreateClient();
        var requestJson = new ValhallaRequest
        {
            Locations = new List<ValhallaLocation>
            {
                new ValhallaLocation
                {
                    Lat = request.From.Y,
                    Lon = request.From.X
                },
                new ValhallaLocation
                {
                    Lat = request.To.Y,
                    Lon = request.To.X
                }
            },
            Costing = ToCosting(request.Profile),
            Units = "m",
            ElevationInterval = 30
        };
        var requestAddress = $"{_options.ValhallaServerAddress}route?json={JsonSerializer.Serialize(requestJson)}";
        for (int retryIndex = 0; retryIndex < 3; retryIndex++)
        {
            var response = await httpClient.GetAsync(requestAddress);
            if (!response.IsSuccessStatusCode)
            {
                await Task.Delay(500);
                continue;
            }
            var content = await response.Content.ReadAsStringAsync();
            var result = JsonSerializer.Deserialize<ValhallaResponse>(content);
            if (result?.Trip?.Status != 0)
            {
                continue;
            }
            var route = result.Trip.Legs[0].Shape;
            var points = DecodePolyline6(route);
            var coordinates = ApplyElevation(points.ToList(), result.Trip.Legs[0].Elevation);
            return new Feature(new LineString(coordinates), new AttributesTable());
        }
        return null;
    }

    public async Task<Feature> GetMapMatch(MapMatchGatewayRequest request)
    {
        var httpClient = _httpClientFactory.CreateClient();
        var traceRequest = new ValhallaTraceRouteRequest
        {
            // Only the endpoints are "break" points (so there is a single leg with a clean
            // depart/arrive); the rest are "via" points the trace is snapped through.
            Shape = request.Points.Select((point, index) => new ValhallaLocation
            {
                Lat = point.Y,
                Lon = point.X,
                Type = index == 0 || index == request.Points.Count - 1 ? "break" : "via"
            }).ToList(),
            Costing = ToCosting(request.Profile),
            ShapeMatch = "map_snap",
            DirectionsOptions = new ValhallaDirectionsOptions
            {
                Language = string.IsNullOrEmpty(request.Language) ? "en-US" : request.Language,
                Units = "kilometers"
            }
        };
        var requestAddress = $"{_options.ValhallaServerAddress}trace_route";
        var requestContent = JsonSerializer.Serialize(traceRequest);
        for (int retryIndex = 0; retryIndex < 3; retryIndex++)
        {
            var response = await httpClient.PostAsync(requestAddress, new StringContent(requestContent, Encoding.UTF8, "application/json"));
            if (!response.IsSuccessStatusCode)
            {
                await Task.Delay(500);
                continue;
            }
            var content = await response.Content.ReadAsStringAsync();
            var result = JsonSerializer.Deserialize<ValhallaResponse>(content);
            if (result?.Trip?.Status != 0 || result.Trip.Legs == null || result.Trip.Legs.Count == 0)
            {
                continue;
            }
            var leg = result.Trip.Legs[0];
            var coordinates = DecodePolyline6(leg.Shape).Select(p => new Coordinate(p.Lng, p.Lat)).ToArray();
            var instructions = BuildInstructions(leg.Maneuvers ?? [], request.Format);
            var table = new AttributesTable { { "instructions", instructions } };
            return new Feature(new LineString(coordinates), table);
        }
        throw new Exception("Unable to map match the given points using Valhalla after 3 retries.");
    }

    private static string ToCosting(ProfileType profile) => profile switch
    {
        ProfileType.Foot => "pedestrian",
        ProfileType.Bike => "bicycle",
        ProfileType.Car4WheelDrive => "truck",
        _ => "pedestrian"
    };

    private static object BuildInstructions(List<ValhallaManeuver> maneuvers, InstructionsFormat format)
    {
        return format == InstructionsFormat.V2
            ? maneuvers.Select(ToRouteInstruction).ToList()
            : maneuvers.Select(ToGraphHopperCompatibleInstruction).ToList();
    }

    // HM TODO: remove this 1.10.2026
    private static GraphHopperCompatibleInstruction ToGraphHopperCompatibleInstruction(ValhallaManeuver maneuver)
    {
        return new GraphHopperCompatibleInstruction
        {
            Text = maneuver.Instruction,
            Distance = maneuver.Length * 1000, // km -> m
            Sign = ToGraphHopperSign(maneuver.Type),
            Interval = [maneuver.BeginShapeIndex, maneuver.EndShapeIndex],
            ExitNumber = GetRoundaboutExitNumber(maneuver)
            // TurnAngle is intentionally left null: Valhalla does not expose it, and the client only
            // uses it for roundabout circulation direction, where null is the correct default here.
        };
    }

    private static RouteInstruction ToRouteInstruction(ValhallaManeuver maneuver)
    {
        return new RouteInstruction
        {
            Type = ToManeuverType(maneuver.Type),
            Text = maneuver.Instruction,
            VerbalText = string.IsNullOrEmpty(maneuver.VerbalPreTransitionInstruction)
                ? maneuver.Instruction
                : maneuver.VerbalPreTransitionInstruction,
            StreetName = maneuver.StreetNames is { Count: > 0 }
                ? string.Join("/", maneuver.StreetNames)
                : null,
            DistanceMeters = maneuver.Length * 1000, // km -> m
            TimeSeconds = maneuver.Time,
            RoundaboutExitNumber = GetRoundaboutExitNumber(maneuver),
            Interval = [maneuver.BeginShapeIndex, maneuver.EndShapeIndex]
        };
    }

    private static int? GetRoundaboutExitNumber(ValhallaManeuver maneuver)
    {
        // Only the "roundabout enter" maneuver (Valhalla type 26) carries an exit count.
        return maneuver.Type == ValhallaRoundaboutEnter && maneuver.RoundaboutExitCount > 0
            ? maneuver.RoundaboutExitCount
            : null;
    }

    // GraphHopper instruction signs (see com.graphhopper.util.Instruction) - the legacy client contract.
    private const int SignUTurnLeft = -8, SignKeepLeft = -7, SignTurnSharpLeft = -3, SignTurnLeft = -2,
        SignTurnSlightLeft = -1, SignContinue = 0, SignTurnSlightRight = 1, SignTurnRight = 2,
        SignTurnSharpRight = 3, SignFinish = 4, SignRoundabout = 6, SignKeepRight = 7, SignUTurnRight = 8;

    // Valhalla maneuver type 26 is "roundabout enter" (see valhalla proto DirectionsLeg.Maneuver.Type).
    private const int ValhallaRoundaboutEnter = 26;

    /// <summary>
    /// Maps a Valhalla maneuver type to the closest GraphHopper sign. Types with no dedicated turn
    /// (start/continue/becomes/straight ramps/roundabout-exit/unknown) collapse to "continue".
    /// </summary>
    private static int ToGraphHopperSign(int valhallaType) => valhallaType switch
    {
        4 or 5 or 6 => SignFinish,                          // destination
        9 or 18 or 20 or 37 => SignTurnSlightRight,         // slight / ramp / exit / merge right
        10 => SignTurnRight,
        11 => SignTurnSharpRight,
        12 => SignUTurnRight,
        13 => SignUTurnLeft,
        14 => SignTurnSharpLeft,
        15 => SignTurnLeft,
        16 or 19 or 21 or 38 => SignTurnSlightLeft,         // slight / ramp / exit / merge left
        23 => SignKeepRight,                                // stay right
        24 => SignKeepLeft,                                 // stay left
        ValhallaRoundaboutEnter => SignRoundabout,
        _ => SignContinue
    };

    /// <summary>
    /// Maps a Valhalla maneuver type to a normalized, engine-agnostic maneuver kind for the V2 model.
    /// </summary>
    private static ManeuverType ToManeuverType(int valhallaType) => valhallaType switch
    {
        1 or 2 or 3 => ManeuverType.Depart,
        4 or 5 or 6 => ManeuverType.Arrive,
        9 => ManeuverType.SlightRight,
        10 => ManeuverType.Right,
        11 => ManeuverType.SharpRight,
        12 => ManeuverType.UturnRight,
        13 => ManeuverType.UturnLeft,
        14 => ManeuverType.SharpLeft,
        15 => ManeuverType.Left,
        16 => ManeuverType.SlightLeft,
        18 or 20 => ManeuverType.RampRight,
        19 or 21 => ManeuverType.RampLeft,
        23 => ManeuverType.KeepRight,
        24 => ManeuverType.KeepLeft,
        25 or 37 or 38 => ManeuverType.Merge,
        ValhallaRoundaboutEnter => ManeuverType.Roundabout,
        27 => ManeuverType.RoundaboutExit,
        28 => ManeuverType.FerryEnter,
        29 => ManeuverType.FerryExit,
        _ => ManeuverType.Continue
    };

    private IEnumerable<(double Lat, double Lng)> DecodePolyline6(string encodedPoints)
    {
        if (string.IsNullOrEmpty(encodedPoints)) yield break;

        int index = 0;
        int lat = 0, lng = 0;

        while (index < encodedPoints.Length)
        {
            int shift = 0, result = 0, b;
            do
            {
                b = encodedPoints[index++] - 63;
                result |= (b & 0x1f) << shift;
                shift += 5;
            } while (b >= 0x20);
            lat += ((result & 1) != 0 ? ~(result >> 1) : (result >> 1));

            shift = 0; result = 0;
            do
            {
                b = encodedPoints[index++] - 63;
                result |= (b & 0x1f) << shift;
                shift += 5;
            } while (b >= 0x20);
            lng += ((result & 1) != 0 ? ~(result >> 1) : (result >> 1));

            // Note the 1e6 divisor for Valhalla's 6-decimal precision
            yield return (lat / 1e6, lng / 1e6);
        }
    }

    private Coordinate[] ApplyElevation(List<(double Lat, double Lng)> points, List<double> elevation, double elevationInterval = 30)
    {
        if (elevation == null || elevation.Count == 0)
        {
            // No elevation data available - fall back to 2D
            return points.Select(p => new Coordinate(p.Lng, p.Lat)).ToArray();
        }

        // Compute cumulative planar distance along the shape for each point
        var cumulativeDistances = new double[points.Count];
        cumulativeDistances[0] = 0;
        for (int i = 1; i < points.Count; i++)
        {
            var prev = points[i - 1];
            var curr = points[i];
            cumulativeDistances[i] = cumulativeDistances[i - 1] + HaversineDistance(prev.Lat, prev.Lng, curr.Lat, curr.Lng);
        }

        var coordinates = new Coordinate[points.Count];

        for (int i = 0; i < points.Count; i++)
        {
            double dist = cumulativeDistances[i];

            // Position within the uniformly-spaced elevation samples
            double samplePos = dist / elevationInterval;
            int sampleIndex = (int)Math.Floor(samplePos);
            sampleIndex = Math.Clamp(sampleIndex, 0, elevation.Count - 1);

            double height;
            if (sampleIndex + 1 < elevation.Count)
            {
                double t = samplePos - sampleIndex;
                t = Math.Clamp(t, 0, 1);
                height = elevation[sampleIndex] + t * (elevation[sampleIndex + 1] - elevation[sampleIndex]);
            }
            else
            {
                height = elevation[sampleIndex];
            }

            coordinates[i] = new CoordinateZ(points[i].Lng, points[i].Lat, height);
        }

        return coordinates;
    }

    private static double HaversineDistance(double lat1, double lon1, double lat2, double lon2)
    {
        const double earthRadiusMeters = 6371000;
        double dLat = (lat2 - lat1) * Math.PI / 180;
        double dLon = (lon2 - lon1) * Math.PI / 180;
        double a = Math.Sin(dLat / 2) * Math.Sin(dLat / 2) +
                   Math.Cos(lat1 * Math.PI / 180) * Math.Cos(lat2 * Math.PI / 180) *
                   Math.Sin(dLon / 2) * Math.Sin(dLon / 2);
        double c = 2 * Math.Atan2(Math.Sqrt(a), Math.Sqrt(1 - a));
        return earthRadiusMeters * c;
    }
}