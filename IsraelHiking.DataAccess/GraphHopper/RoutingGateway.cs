using System.Linq;
using System.Net.Http;
using System.Threading.Tasks;
using GeoAPI.Geometries;
using IsraelHiking.Common;
using IsraelHiking.DataAccess.JsonResponse;
using IsraelHiking.DataAccessInterfaces;
using NetTopologySuite.Geometries;
using Newtonsoft.Json;

namespace IsraelHiking.DataAccess.GraphHopper
{
    public class RoutingGateway : IRoutingGateway
    {
        private readonly ILogger _logger;

        public RoutingGateway(ILogger logger)
        {
            _logger = logger;
        }

        public async Task<LineString> GetRouting(RoutingGatewayRequest request)
        {
            using (var httpClient = new HttpClient())
            {
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
                var requestAddress = "http://localhost:8989/route?instructions=false&points_encoded=false&elevation=true&point=" + request.From + "&point=" + request.To + "&vehicle=" + vehicle;
                var response = await httpClient.GetAsync(requestAddress);
                var content = await response.Content.ReadAsStringAsync();
                var jsonResponse = JsonConvert.DeserializeObject<JsonGraphHopperResponse>(content);
                if (jsonResponse.paths.Count <= 0)
                {
                    return new LineString(new Coordinate[0]);
                }
                if (jsonResponse.paths.First().points.coordinates.Count == 1)
                {
                    var jsonCoordinates = jsonResponse.paths.First().points.coordinates.First();
                    var convertedCoordiates = new Coordinate(jsonCoordinates[0], jsonCoordinates[1], jsonCoordinates.Count > 2 ? jsonCoordinates[2] : 0.0);
                    return new LineString(new [] { convertedCoordiates, convertedCoordiates});
                }
                return new LineString(jsonResponse.paths.First().points.coordinates.Select(c => new Coordinate(c[0], c[1], c.Count > 2 ? c[2] : 0.0)).ToArray());
            }
        }
    }
}
