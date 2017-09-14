using IsraelHiking.Common;
using IsraelHiking.DataAccessInterfaces;
using System.Collections.ObjectModel;
using System.Linq;
using System.Threading.Tasks;
using GeoAPI.Geometries;
using NetTopologySuite.Features;
using NetTopologySuite.Geometries;
using Microsoft.AspNetCore.Mvc;

namespace IsraelHiking.API.Controllers
{
    /// <summary>
    /// This controller allows routing between two points
    /// </summary>
    [Route("api/[controller]")]
    public class RoutingController : Controller
    {
        private readonly IGraphHopperGateway _graphHopperGateway;
        private readonly IElevationDataStorage _elevationDataStorage;

        /// <summary>
        /// Controller's constructor
        /// </summary>
        /// <param name="graphHopperGateway"></param>
        /// <param name="elevationDataStorage"></param>
        public RoutingController(IGraphHopperGateway graphHopperGateway,
            IElevationDataStorage elevationDataStorage)
        {
            _graphHopperGateway = graphHopperGateway;
            _elevationDataStorage = elevationDataStorage;
        }

        /// <summary>
        /// Creates a route bwteeen the given points according to routing type
        /// </summary>
        /// <param name="from">The start point of the route</param>
        /// <param name="to">The end point of the route</param>
        /// <param name="type">The type of routing: "Hike", "Bike", "4WD", "None"</param>
        /// <returns>The calculated route</returns>
        //GET /api/routing?from=31.8239,35.0375&to=31.8213,35.0965&type=hike
        [HttpGet]
        [ProducesResponseType(typeof(FeatureCollection), 200)]
        public async Task<IActionResult> GetRouting(string from, string to, string type)
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
                lineString = await _graphHopperGateway.GetRouting(new RoutingGatewayRequest
                {
                    From = from,
                    To = to,
                    Profile = profile,
                });
                if (!lineString.Coordinates.Any())
                {
                    lineString = new LineString(new[] { pointFrom, pointTo });
                }
                foreach (var coordinate in lineString.Coordinates)
                {
                    coordinate.Z = await _elevationDataStorage.GetElevation(coordinate);
                }
            }
            var table = new AttributesTable
            {
                {"Name", "Routing from " + @from + " to " + to + " profile type: " + profile},
                {"Creator", "IsraelHikingMap"}
            };
            var feature = new Feature(lineString, table);
            return Ok(new FeatureCollection(new Collection<IFeature> { feature }));
        }

        private static ProfileType ConvertProfile(string type)
        {
            var profile = ProfileType.Foot;
            switch (type)
            {
                case RoutingType.HIKE:
                    profile = ProfileType.Foot;
                    break;
                case RoutingType.BIKE:
                    profile = ProfileType.Bike;
                    break;
                case RoutingType.FOUR_WHEEL_DRIVE:
                    profile = ProfileType.Car;
                    break;
                case RoutingType.NONE:
                    profile = ProfileType.None;
                    break;
            }
            return profile;
        }

        private async Task<Coordinate> GetGeographicPosition(string position)
        {
            var splitted = position.Split(',');
            if (splitted.Length != 2)
            {
                ModelState.AddModelError("Position", $"Invalid position: {position} format should be number,number");
                return null;
            }
            var lat = double.Parse(splitted.First());
            var lng = double.Parse(splitted.Last());
            var elevation = await _elevationDataStorage.GetElevation(new Coordinate().FromLatLng(position));
            return new Coordinate(lng, lat, elevation);
        }
    }
}
