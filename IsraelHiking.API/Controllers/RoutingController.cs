using IsraelHiking.API.Executors;
using IsraelHiking.Common;
using IsraelHiking.DataAccessInterfaces;
using Microsoft.AspNetCore.Mvc;
using NetTopologySuite.Features;
using NetTopologySuite.Geometries;
using ProjNet.CoordinateSystems.Transformations;
using System;
using System.Collections.ObjectModel;
using System.Linq;
using System.Threading.Tasks;

namespace IsraelHiking.API.Controllers
{
    /// <summary>
    /// This controller allows routing between two points
    /// </summary>
    [Route("api/[controller]")]
    public class RoutingController : ControllerBase
    {
        private readonly IGraphHopperGateway _graphHopperGateway;
        private readonly IElevationDataStorage _elevationDataStorage;
        private readonly GeometryFactory _geometryFactory;
        private readonly MathTransform _wgs84ItmMathTransform;

        /// <summary>
        /// Controller's constructor
        /// </summary>
        /// <param name="graphHopperGateway"></param>
        /// <param name="elevationDataStorage"></param>
        /// <param name="itmWgs84MathTransfromFactory"></param>
        /// <param name="geometryFactory"></param>
        public RoutingController(IGraphHopperGateway graphHopperGateway,
            IElevationDataStorage elevationDataStorage,
            IItmWgs84MathTransfromFactory itmWgs84MathTransfromFactory,
            GeometryFactory geometryFactory)
        {
            _graphHopperGateway = graphHopperGateway;
            _elevationDataStorage = elevationDataStorage;
            _geometryFactory = geometryFactory;
            _wgs84ItmMathTransform = itmWgs84MathTransfromFactory.CreateInverse();
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
                lineString = GetDenseStraightLine(pointFrom, pointTo);
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
                    lineString = _geometryFactory.CreateLineString(new[] { pointFrom, pointTo }) as LineString;
                }
            }
            foreach (var coordinate in lineString.Coordinates)
            {
                coordinate.Z = await _elevationDataStorage.GetElevation(coordinate);
            }
            var table = new AttributesTable
            {
                {"Name", "Routing from " + @from + " to " + to + " profile type: " + profile},
                {"Creator", "IsraelHikingMap"}
            };
            var feature = new Feature(lineString, table);
            return Ok(new FeatureCollection{ feature });
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
            var elevation = await _elevationDataStorage.GetElevation(position.ToCoordinate());
            return new CoordinateZ(lng, lat, elevation);
        }

        /// <summary>
        /// Getting a straight line between two points.
        /// Since the elevation resultion is 30 meters there's no need to sample distances that are
        /// less than 30 meters. Maximal total points is 30 to limit the response size.
        /// </summary>
        /// <param name="from"></param>
        /// <param name="to"></param>
        /// <returns></returns>
        private LineString GetDenseStraightLine(Coordinate from, Coordinate to)
        {
            var itmFrom = _wgs84ItmMathTransform.Transform(from.X, from.Y);
            var itmTo = _wgs84ItmMathTransform.Transform(to.X, to.Y);
            var samples = (int)Math.Min(new Point(itmFrom.x, itmFrom.y).Distance(new Point(itmTo.x, itmTo.y)) / 30, 30);
            if (samples == 0)
            {
                return _geometryFactory.CreateLineString(new[] {from, to}) as LineString;
            }
            var coordinates = Enumerable.Range(0, samples + 1).Select(s => new CoordinateZ(
                (to.X - from.X) * s / samples + from.X,
                (to.Y - from.Y) * s / samples + from.Y,
                0)
            );
            return _geometryFactory.CreateLineString(coordinates.ToArray()) as LineString;
        }
    }
}
