using GeoJSON.Net.Feature;
using GeoJSON.Net.Geometry;
using IsraelHiking.Common;
using IsraelHiking.DataAccessInterfaces;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using System.Web.Http;
using System.Web.Http.Description;

namespace IsraelHiking.API.Controllers
{
    public class RoutingController : ApiController
    {
        private readonly IRoutingGateway _routingGateway;
        private readonly IElevationDataStorage _elevationDataStorage;
        private readonly ILogger _logger;

        public RoutingController(IRoutingGateway routingGateway,
            IElevationDataStorage elevationDataStorage,
            ILogger logger)
        {
            _routingGateway = routingGateway;
            _elevationDataStorage = elevationDataStorage;
            _logger = logger;
        }

        [ResponseType(typeof(FeatureCollection))]
        [HttpGet]
        //GET /api/routing?from=31.8239,35.0375&to=31.8213,35.0965&type=f
        public async Task<IHttpActionResult> GetRouting(string from, string to, string type)
        {
            LineString lineString;
            var profile = ConvertProfile(type);
            var pointFrom = await GetGeographicPosition(from);
            var pointTo = await GetGeographicPosition(to);
            if (ModelState.IsValid == false)
            {
                return BadRequest(ModelState);
            }
            if (profile == ProfileType.None)
            {   
                lineString = new LineString(new[] { pointFrom, pointTo });
            }
            else
            {
                lineString = await _routingGateway.GetRouting(new RoutingGatewayRequest
                {
                    From = from,
                    To = to,
                    Profile = profile,
                });
            }
            var feature = new Feature(lineString, new FeatureProperties { Name = "Routing from " + from + " to " + to + " profile type: " + profile, Creator = "IsraelHikingMap" });
            return Ok(new FeatureCollection(new List<Feature> { feature }));
        }

        private static ProfileType ConvertProfile(string type)
        {
            var profile = ProfileType.Foot;
            switch (type)
            {
                case "Hike":
                    profile = ProfileType.Foot;
                    break;
                case "Bike":
                    profile = ProfileType.Bike;
                    break;
                case "4WD":
                    profile = ProfileType.Car;
                    break;
                case "None":
                    profile = ProfileType.None;
                    break;
            }
            return profile;
        }

        private async Task<GeographicPosition> GetGeographicPosition(string position)
        {
            var splitted = position.Split(',');
            if (splitted.Length != 2)
            {
                ModelState.AddModelError("Position", $"Invalid position: {position} format should be number,number");
                return null;
            }
            var lat = double.Parse(splitted.First());
            var lng = double.Parse(splitted.Last());
            var elevation = await _elevationDataStorage.GetElevation(lat, lng);
            return new GeographicPosition(lat, lng, elevation);
        }
    }
}
