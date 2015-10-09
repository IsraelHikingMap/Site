using GeoJSON.Net.Feature;
using IsraelHiking.DataAccess;
using System.Threading.Tasks;
using System.Web.Http;

namespace IsraelHiking.API.Controllers
{
    public class RoutingController : ApiController
    {
        private readonly RoutingGateway _routingGateway;

        public RoutingController()
        {
            _routingGateway = new RoutingGateway();
        }

        //GET /api/routing?from=31.8239,35.0375&to=31.8213,35.0965&type=f
        public async Task<FeatureCollection> GetRouting(string from, string to, string type)
        {
            if (type == "n")
            {
                //HM TODO: none routing - should only get evelation and return two points geojson?
                return null;
            }

            return await _routingGateway.GetRouting(new RoutingGatewayRequest
            {
                From = from,
                To = to,
                Profile = ConvertProfile(type)
            });
        }

        private static ProfileType ConvertProfile(string type)
        {
            var profile = ProfileType.Foot;
            switch (type)
            {
                case "h":
                    profile = ProfileType.Foot;
                    break;
                case "b":
                    profile = ProfileType.Bike;
                    break;
                case "f":
                    profile = ProfileType.Car;
                    break;
            }

            return profile;
        }
    }
}
