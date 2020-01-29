using GeoAPI.Geometries;
using IsraelHiking.Common;
using IsraelHiking.DataAccessInterfaces;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using NetTopologySuite.Geometries;
using Newtonsoft.Json;
using System;
using System.IO;
using System.Linq;
using System.Net.Http;
using System.Threading.Tasks;

namespace IsraelHiking.DataAccess
{
    public class GraphHopperGateway : IGraphHopperGateway
    {
        private readonly IHttpClientFactory _httpClientFactory;
        private readonly ILogger _logger;
        private readonly ConfigurationData _options;

        public GraphHopperGateway(IHttpClientFactory httpClientFactory, IOptions<ConfigurationData> options, ILogger logger)
        {
            _httpClientFactory = httpClientFactory;
            _options = options.Value;
            _logger = logger;
        }

        public async Task<LineString> GetRouting(RoutingGatewayRequest request)
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
                case ProfileType.Car:
                    vehicle = "car4wd";
                    break;
            }
            var requestAddress = $"{_options.GraphhopperServerAddress}route?instructions=false&points_encoded=false&elevation=true&point={request.From}&point={request.To}&vehicle={vehicle}";
            var response = await httpClient.GetAsync(requestAddress);
            var content = await response.Content.ReadAsStringAsync();
            var jsonResponse = JsonConvert.DeserializeObject<JsonGraphHopperResponse>(content);
            if (jsonResponse?.paths == null || !jsonResponse.paths.Any())
            {
                return new LineString(new Coordinate[0]); // CoordinateZ
            }
            if (jsonResponse.paths.First().points.coordinates.Count == 1)
            {
                var jsonCoordinates = jsonResponse.paths.First().points.coordinates.First();
                var convertedCoordiates = new Coordinate(jsonCoordinates[0], jsonCoordinates[1], jsonCoordinates.Count > 2 ? jsonCoordinates[2] : 0.0);
                return new LineString(new[] { convertedCoordiates, convertedCoordiates });
            }
            return new LineString(jsonResponse.paths.First().points.coordinates.Select(c => new Coordinate(c[0], c[1], c.Count > 2 ? c[2] : 0.0)).ToArray());
        }

        public async Task Rebuild(MemoryStream osmFileStream)
        {
            _logger.LogInformation($"Starting creating graph hopper cache based on latest pbf file: {Sources.OSM_FILE_NAME}");
            var httpClient = _httpClientFactory.CreateClient();
            httpClient.Timeout = TimeSpan.FromMinutes(30);
            var requestAddress = $"{_options.GraphhopperServerAddress}rebuild";
            ByteArrayContent bytes = new ByteArrayContent(osmFileStream.ToArray());
            MultipartFormDataContent multiContent = new MultipartFormDataContent();
            multiContent.Add(bytes, "file", Sources.OSM_FILE_NAME);
            await httpClient.PostAsync(requestAddress, multiContent);
            _logger.LogInformation($"Finished creating graph hopper cache based on latest pbf file: {Sources.OSM_FILE_NAME}");
        }
    }
}
