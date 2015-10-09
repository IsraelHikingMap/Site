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
        public RoutingGateway()
        {
            // HM TODO: check if routing server is up, if not, run it...
        }

        public async Task<FeatureCollection> GetRouting(RoutingGatewayRequest request)
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
                var response = await httpClient.GetAsync("http://localhost:8989/route?instructions=false&points_encoded=false&point=" + request.From + "&point=" + request.To + "&vehicle=" + vehicle);
                var content = await response.Content.ReadAsStringAsync();
                var jsonResponse = JsonConvert.DeserializeObject<JsonGraphHopperResponse>(content);

                var lineString = new LineString(jsonResponse.paths.First().points.coordinates.Select(c => new GeographicPosition(c[0], c[1], c.Count > 2 ? c[2] : (double?)null)));
                var feature = new Feature(lineString, new FeatureProperties { Name = "Routing from " + request.From + " to " + request.To + " vehicle: " + vehicle, Creator = "IsraelHiking" });
                return new FeatureCollection(new List<Feature>() { feature });
            }
        }
    }
}
