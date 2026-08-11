using IsraelHiking.Common.Api;
using IsraelHiking.Common.Configuration;
using IsraelHiking.DataAccessInterfaces;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using NetTopologySuite.Features;
using NetTopologySuite.Geometries;
using NetTopologySuite.IO;
using System.Text.Json.Serialization;
using System.Collections.Generic;
using System.Linq;
using System.Net.Http;
using System.Text.Json;
using System.Threading.Tasks;
using System.Xml;
using System.Text;
using System.IO;
using System;

namespace IsraelHiking.DataAccess;

internal class JsonGraphHopperResponse
{
    [JsonPropertyName("paths")]
    public List<JsonPath> Paths { get; set; }
}

internal class JsonPath
{
    [JsonPropertyName("distance")]
    public double Distance { get; set; }
    [JsonPropertyName("bbox")]
    public List<double> Bbox { get; set; }
    [JsonPropertyName("weight")]
    public double Weight { get; set; }
    [JsonPropertyName("time")]
    public long Time { get; set; }
    [JsonPropertyName("points_encoded")]
    public bool PointsEncoded { get; set; }
    [JsonPropertyName("points")]
    public JsonPoints Points { get; set; }
    [JsonPropertyName("details")]
    public JsonDetails Details { get; set; }
    [JsonPropertyName("instructions")]
    public List<JsonInstructions> Instructions { get; set; }
}

internal class JsonPoints
{
    [JsonPropertyName("type")]
    public string Type { get; set; }
    [JsonPropertyName("coordinates")]
    public List<List<double>> Coordinates { get; set; }
}

internal class JsonDetails
{
    // two leading indexes and a string
    [JsonPropertyName("road_class")]
    public List<List<object>> RoadClass { get; set; }
    // two leading indexes and a string
    [JsonPropertyName("track_type")]
    public List<List<object>> TrackType { get; set; }
}

internal class JsonInstructions
{
    [JsonPropertyName("text")]
    public string Text { get; set; }
    [JsonPropertyName("distance")]
    public double Distance { get; set; } // In meters
    [JsonPropertyName("time")]
    public long Time { get; set; } // In milliseconds
    [JsonPropertyName("interval")]
    public List<int> Interval { get; set; }
    [JsonPropertyName("sign")]
    public int Sign { get; set; }
    [JsonPropertyName("exit_number")]
    public int? ExitNumber { get; set; }
    [JsonPropertyName("turn_angle")]
    public double? TurnAngle { get; set; }
}

public class GraphHopperGateway(IHttpClientFactory httpClientFactory,
    IOptions<ConfigurationData> options,
    ILogger logger) : IRoutingGateway
{
    private readonly IHttpClientFactory _httpClientFactory = httpClientFactory;
    private readonly ConfigurationData _options = options.Value;
    private readonly ILogger _logger = logger;

    public async Task<Feature> GetRouting(RoutingGatewayRequest request)
    {
        var httpClient = _httpClientFactory.CreateClient();
        string profile = request.Profile switch
        {
            ProfileType.Foot => "hike",
            ProfileType.Bike => "mtb",
            ProfileType.Car4WheelDrive => "car4wd",
            _ => "hike"
        };
        var fromStr = $"{request.From.Y},{request.From.X}";
        var toStr = $"{request.To.Y},{request.To.X}";
        var requestAddress = $"{_options.GraphhopperServerAddress}route?instructions=false&points_encoded=false&elevation=true&details=track_type&details=road_class&point={fromStr}&point={toStr}&profile={profile}";
        for (int retryIndex = 0; retryIndex < 3; retryIndex++)
        {
            var response = await httpClient.GetAsync(requestAddress);
            if (!response.IsSuccessStatusCode)
            {
                await Task.Delay(500);
                continue;
            }
            var content = await response.Content.ReadAsStringAsync();
            var jsonResponse = JsonSerializer.Deserialize<JsonGraphHopperResponse>(content);
            if (jsonResponse?.Paths == null || !jsonResponse.Paths.Any())
            {
                _logger.LogWarning($"Problem with routing response: {response.StatusCode} {content}");
                return LineStringToFeature(new LineString([request.From, request.To]));
            }
            var path = jsonResponse.Paths.First();
            if (path.Points.Coordinates.Count == 1)
            {
                var jsonCoordinates = path.Points.Coordinates.First();
                var convertedCoordinates = new CoordinateZ(jsonCoordinates[0], jsonCoordinates[1], jsonCoordinates.Count > 2 ? jsonCoordinates[2] : 0.0);
                _logger.LogWarning($"Problem with routing response: got only one point back from graphhopper...");
                return LineStringToFeature(new LineString([convertedCoordinates, convertedCoordinates]));
            }
            var lineString = new LineString(path.Points.Coordinates.Select(c => new CoordinateZ(c[0], c[1], c.Count > 2 ? c[2] : 0.0)).ToArray());
            var table = new AttributesTable { { "details", path.Details } };
            return LineStringToFeature(lineString, table);
        }
        _logger.LogWarning($"Problem with routing response after max 3 retries.");
        return LineStringToFeature(new LineString([request.From, request.To]));
    }

    private Feature LineStringToFeature(LineString line, AttributesTable table = null)
    {
        return new Feature(line, table ?? []);
    }

    public async Task<Feature> GetMapMatch(MapMatchGatewayRequest request)
    {
        string profile = request.Profile switch
        {
            ProfileType.Foot => "hike",
            ProfileType.Bike => "mtb",
            ProfileType.Car4WheelDrive => "car4wd",
            _ => "hike"
        };
        var httpClient = _httpClientFactory.CreateClient();
        var requestAddress = $"{_options.GraphhopperServerAddress}match?instructions=true&elevation=false&points_encoded=false&profile={profile}&locale={request.Language.Replace("-", "_")}";
        var gpx = new GpxFile()
        {
            Metadata = new GpxMetadata("Request")
        };
        var waypoints = request.Points.Select(p => new GpxWaypoint(new GpxLongitude(p.X), new GpxLatitude(p.Y))).ToList();
        var track = new GpxTrack().WithSegments(
            [new GpxTrackSegment().WithWaypoints(waypoints)]
        );
        gpx.Tracks.Add(track);
        using var outputStream = new MemoryStream();
        var xmlWriterSettings = new XmlWriterSettings
        {
            Indent = true,
            IndentChars = "\t",
            Encoding = Encoding.UTF8
        };

        using (var xmlWriter = XmlWriter.Create(outputStream, xmlWriterSettings))
        {
            gpx.WriteTo(xmlWriter, new GpxWriterSettings());
            xmlWriter.Flush();
        }
        outputStream.Position = 0;
        var requestContent = new StreamContent(outputStream);
        requestContent.Headers.ContentType = new System.Net.Http.Headers.MediaTypeHeaderValue("application/gpx+xml");
        var response = await httpClient.PostAsync(requestAddress, requestContent);
        var responseContent = await response.Content.ReadAsStringAsync();
        var jsonResponse = JsonSerializer.Deserialize<JsonGraphHopperResponse>(responseContent);
        if (jsonResponse?.Paths == null || !jsonResponse.Paths.Any())
        {
            throw new Exception($"Problem with match response: {response.StatusCode} {responseContent}");
        }
        var path = jsonResponse.Paths.First();
        var lineString = new LineString(path.Points.Coordinates.Select(c => new CoordinateZ(c[0], c[1], c.Count > 2 ? c[2] : 0.0)).ToArray());
        var table = new AttributesTable { { "instructions", BuildInstructions(path.Instructions ?? [], request.Format) } };
        return LineStringToFeature(lineString, table);
    }

    private static object BuildInstructions(List<JsonInstructions> instructions, InstructionsFormat format)
    {
        // Legacy: the raw GraphHopper instructions (sign/text/distance/exit_number/turn_angle) are
        // already the shape shipped clients expect, so they are returned as-is.
        return format == InstructionsFormat.V2
            ? instructions.Select(ToRouteInstruction).ToList()
            : instructions;
    }

    private static RouteInstruction ToRouteInstruction(JsonInstructions instruction)
    {
        return new RouteInstruction
        {
            Type = ToManeuverType(instruction.Sign),
            Text = instruction.Text,
            // GraphHopper has no separate spoken variant or street-name field (the name is baked into
            // the text), so fall back to Text for voice and leave StreetName null.
            VerbalText = instruction.Text,
            StreetName = null,
            DistanceMeters = instruction.Distance,
            TimeSeconds = instruction.Time / 1000.0, // ms -> s
            // GraphHopper only populates exit_number on roundabout maneuvers.
            RoundaboutExitNumber = instruction.Sign == SignRoundabout ? instruction.ExitNumber : null,
            Interval = instruction.Interval?.ToArray()
        };
    }

    // GraphHopper instruction signs (see com.graphhopper.util.Instruction).
    private const int SignUTurnLeft = -8, SignKeepLeft = -7, SignLeaveRoundabout = -6, SignTurnSharpLeft = -3,
        SignTurnLeft = -2, SignTurnSlightLeft = -1, SignContinue = 0, SignTurnSlightRight = 1, SignTurnRight = 2,
        SignTurnSharpRight = 3, SignFinish = 4, SignReachedVia = 5, SignRoundabout = 6, SignKeepRight = 7,
        SignUTurnRight = 8;

    /// <summary>
    /// Maps a GraphHopper instruction sign to the normalized, engine-agnostic maneuver kind for the V2
    /// model. Signs with no dedicated kind (e.g. the start instruction, which GraphHopper emits as
    /// <see cref="SignContinue"/>) collapse to "continue".
    /// </summary>
    private static ManeuverType ToManeuverType(int sign) => sign switch
    {
        SignUTurnLeft => ManeuverType.UturnLeft,
        SignKeepLeft => ManeuverType.KeepLeft,
        SignLeaveRoundabout => ManeuverType.RoundaboutExit,
        SignTurnSharpLeft => ManeuverType.SharpLeft,
        SignTurnLeft => ManeuverType.Left,
        SignTurnSlightLeft => ManeuverType.SlightLeft,
        SignTurnSlightRight => ManeuverType.SlightRight,
        SignTurnRight => ManeuverType.Right,
        SignTurnSharpRight => ManeuverType.SharpRight,
        SignFinish or SignReachedVia => ManeuverType.Arrive,
        SignRoundabout => ManeuverType.Roundabout,
        SignKeepRight => ManeuverType.KeepRight,
        SignUTurnRight => ManeuverType.UturnRight,
        _ => ManeuverType.Continue
    };
}