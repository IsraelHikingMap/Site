using IsraelHiking.Common;
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
        public List<JsonPath> paths { get; set; }
    }

    internal class JsonPath
    {
        public double distance { get; set; }
        public List<double> bbox { get; set; }
        public double weight { get; set; }
        public long time { get; set; }
        public bool points_encoded { get; set; }
        public JsonPoints points { get; set; }
        public JsonDetails details { get; set; }
    }

    internal class JsonPoints
    {
        public string type { get; set; }
        public List<List<double>> coordinates { get; set; }
    }

    internal class JsonDetails
    {
        public List<List<string>> road_class { get; set; }
        public List<List<string>> track_type { get; set; }
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
            if (jsonResponse?.paths == null || !jsonResponse.paths.Any())
            {
                return LineStringToFeature(new LineString(new[] { request.From, request.To }));
            }
            var path = jsonResponse.paths.First();
            if (path.points.coordinates.Count == 1)
            {
                var jsonCoordinates = path.points.coordinates.First();
                var convertedCoordiates = new CoordinateZ(jsonCoordinates[0], jsonCoordinates[1], jsonCoordinates.Count > 2 ? jsonCoordinates[2] : 0.0);
                return LineStringToFeature(new LineString(new[] { convertedCoordiates, convertedCoordiates }));
            }
            var lineString = new LineString(path.points.coordinates.Select(c => new CoordinateZ(c[0], c[1], c.Count > 2 ? c[2] : 0.0)).ToArray());
            var table = new AttributesTable { { "details", path.details } };
            return LineStringToFeature(lineString, table);
        }

        private Feature LineStringToFeature(LineString line, AttributesTable table = null)
        {
            return new Feature(line, table ?? new AttributesTable());
        }
    }
}
