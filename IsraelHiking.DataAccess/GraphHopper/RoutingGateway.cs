using System.Linq;
using System.Net.Http;
using System.Threading.Tasks;
using GeoJSON.Net.Geometry;
using IsraelHiking.Common;
using IsraelHiking.DataAccess.JsonResponse;
using IsraelHiking.DataAccessInterfaces;
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
                        vehicle = "car";
                        break;
                }
                var requestAddress = "http://localhost:8989/route?instructions=false&points_encoded=false&elevation=true&point=" + request.From + "&point=" + request.To + "&vehicle=" + vehicle;
                _logger.Debug("Get routing for: " + requestAddress);
                var response = await httpClient.GetAsync(requestAddress);
                var content = await response.Content.ReadAsStringAsync();
                _logger.Debug("Got routing: " + content);
                var jsonResponse = JsonConvert.DeserializeObject<JsonGraphHopperResponse>(content);

                return new LineString(jsonResponse.paths.First().points.coordinates.Select(c => new GeographicPosition(c[1], c[0], c.Count > 2 ? c[2] : (double?)null)));
            }
        }
    }
}
