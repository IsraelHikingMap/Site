using IsraelHiking.Common.Api;
using IsraelHiking.Common.Configuration;
using IsraelHiking.DataAccessInterfaces;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using NetTopologySuite.Features;
using NetTopologySuite.Geometries;
using System.Text.Json.Serialization;
using System.Collections.Generic;
using System.Linq;
using System.Net.Http;
using System.Text.Json;
using System.Threading.Tasks;

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

public class GraphHopperGateway : IGraphHopperGateway
{
    private readonly IHttpClientFactory _httpClientFactory;
    private readonly ConfigurationData _options;
    private readonly ILogger _logger;

    public GraphHopperGateway(IHttpClientFactory httpClientFactory,
        IOptions<ConfigurationData> options,
        ILogger logger)
    {
        _httpClientFactory = httpClientFactory;
        _options = options.Value;
        _logger = logger;
    }

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
        return new Feature(line, table ?? new AttributesTable());
    }
}