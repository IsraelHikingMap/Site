using GeoJSON.Net.Feature;
using GeoJSON.Net.Geometry;
using IsraelHiking.DataAccess.JsonResponse;
using Newtonsoft.Json;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Net.Http;
using System.Text;
using System.Threading.Tasks;

namespace IsraelHiking.DataAccess
{
    public class RoutingGateway
    {
        private readonly Logger _logger;
        private readonly ElevationDataStorage _elevationDataStorage;

        public RoutingGateway()
        {
            _logger = new Logger();
            _elevationDataStorage = ElevationDataStorage.Instance;
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

                //return new LineString(jsonResponse.paths.First().points.coordinates.Select(c => new GeographicPosition(c[1], c[0], c.Count > 2 ? c[2] : (double?)null)));
                return new LineString(jsonResponse.paths.First().points.coordinates.Select(c => new GeographicPosition(c[1], c[0], _elevationDataStorage.GetElevation(c[1], c[0]))));
            }
        }
    }
}
