using IsraelHiking.Common;
using IsraelHiking.Common.Configuration;
using IsraelHiking.DataAccessInterfaces;
using Microsoft.Extensions.Options;
using NetTopologySuite.Features;
using NetTopologySuite.Geometries;
using Newtonsoft.Json;
using System.Collections.Generic;
using System.Linq;
using System.Net.Http;
using System.Threading.Tasks;

namespace IsraelHiking.DataAccess
{
    internal class JsonGraphHopperResponse
    {
        [JsonProperty("paths")]
        public List<JsonPath> Paths { get; set; }
    }

    internal class JsonPath
    {
        [JsonProperty("distance")]
        public double Distance { get; set; }
        [JsonProperty("bbox")]
        public List<double> Bbox { get; set; }
        [JsonProperty("weight")]
        public double Weight { get; set; }
        [JsonProperty("time")]
        public long Time { get; set; }
        [JsonProperty("points_encoded")]
        public bool PointsEncoded { get; set; }
        [JsonProperty("points")]
        public JsonPoints Points { get; set; }
        [JsonProperty("details")]
        public JsonDetails Details { get; set; }
    }

    internal class JsonPoints
    {
        [JsonProperty("type")]
        public string Type { get; set; }
        [JsonProperty("coordinates")]
        public List<List<double>> Coordinates { get; set; }
    }

    internal class JsonDetails
    {
        [JsonProperty("road_class")]
        public List<List<string>> RoadClass { get; set; }
        [JsonProperty("track_type")]
        public List<List<string>> TrackType { get; set; }
    }

    public class GraphHopperGateway : IGraphHopperGateway
    {
        private readonly IHttpClientFactory _httpClientFactory;
        private readonly ConfigurationData _options;

        public GraphHopperGateway(IHttpClientFactory httpClientFactory, IOptions<ConfigurationData> options)
        {
            _httpClientFactory = httpClientFactory;
            _options = options.Value;
        }

        public async Task<Feature> GetRouting(RoutingGatewayRequest request)
        {
            var httpClient = _httpClientFactory.CreateClient();
            string vehicle = "foot";
            switch (request.Profile)
            {
                case ProfileType.Foot:
                    vehicle = "foot";
                    break;
                case ProfileType.Bike:
                    vehicle = "bike2";
                    break;
                case ProfileType.Car4WheelDrive:
                    vehicle = "car4wd";
                    break;
                case ProfileType.Car:
                    vehicle = "car";
                    break;
            }
            var fromStr = $"{request.From.Y},{request.From.X}";
            var toStr = $"{request.To.Y},{request.To.X}";
            var requestAddress = $"{$"{_options.GraphhopperServerAddress}route?instructions=false&points_encoded=false&elevation=true&details=track_type&details=road_class&point="}{fromStr}&point={toStr}&vehicle={vehicle}";
            var response = await httpClient.GetAsync(requestAddress);
            var content = await response.Content.ReadAsStringAsync();
            var jsonResponse = JsonConvert.DeserializeObject<JsonGraphHopperResponse>(content);
            if (jsonResponse?.Paths == null || !jsonResponse.Paths.Any())
            {
                return LineStringToFeature(new LineString(new[] { request.From, request.To }));
            }
            var path = jsonResponse.Paths.First();
            if (path.Points.Coordinates.Count == 1)
            {
                var jsonCoordinates = path.Points.Coordinates.First();
                var convertedCoordiates = new CoordinateZ(jsonCoordinates[0], jsonCoordinates[1], jsonCoordinates.Count > 2 ? jsonCoordinates[2] : 0.0);
                return LineStringToFeature(new LineString(new[] { convertedCoordiates, convertedCoordiates }));
            }
            var lineString = new LineString(path.Points.Coordinates.Select(c => new CoordinateZ(c[0], c[1], c.Count > 2 ? c[2] : 0.0)).ToArray());
            var table = new AttributesTable { { "details", path.Details } };
            return LineStringToFeature(lineString, table);
        }

        private Feature LineStringToFeature(LineString line, AttributesTable table = null)
        {
            return new Feature(line, table ?? new AttributesTable());
        }
    }
}
