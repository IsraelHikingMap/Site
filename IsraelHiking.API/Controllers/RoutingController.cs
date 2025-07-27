using IsraelHiking.API.Executors;
using IsraelHiking.Common.Api;
using IsraelHiking.Common.DataContainer;
using IsraelHiking.Common.Extensions;
using IsraelHiking.DataAccessInterfaces;
using Microsoft.AspNetCore.Mvc;
using NetTopologySuite.Features;
using NetTopologySuite.Geometries;
using ProjNet.CoordinateSystems.Transformations;
using System;
using System.Linq;
using System.Threading.Tasks;

namespace IsraelHiking.API.Controllers;

/// <summary>
/// This controller allows routing between two points
/// </summary>
[Route("api/[controller]")]
public class RoutingController : ControllerBase
{
    private readonly IGraphHopperGateway _graphHopperGateway;
    private readonly IElevationSetterExecutor _elevationSetterExecutor;
    private readonly GeometryFactory _geometryFactory;
    private readonly MathTransform _wgs84ItmMathTransform;

    /// <summary>
    /// Controller's constructor
    /// </summary>
    /// <param name="graphHopperGateway"></param>
    /// <param name="elevationSetterExecutor"></param>
    /// <param name="itmWgs84MathTransformFactory"></param>
    /// <param name="geometryFactory"></param>
    public RoutingController(IGraphHopperGateway graphHopperGateway,
        IElevationSetterExecutor elevationSetterExecutor,
        IItmWgs84MathTransformFactory itmWgs84MathTransformFactory,
        GeometryFactory geometryFactory)
    {
        _graphHopperGateway = graphHopperGateway;
        _elevationSetterExecutor = elevationSetterExecutor;
        _geometryFactory = geometryFactory;
        _wgs84ItmMathTransform = itmWgs84MathTransformFactory.CreateInverse();
    }

    /// <summary>
    /// Creates a route between the given points according to routing type
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
        var profile = ConvertProfile(type);
        var pointFrom = GetGeographicPosition(from);
        var pointTo = GetGeographicPosition(to);
        if (ModelState.IsValid == false)
        {
            return BadRequest(ModelState);
        }
        var feature = profile == ProfileType.None 
            ? GetDenseStraightLine(pointFrom, pointTo)
            : await _graphHopperGateway.GetRouting(new RoutingGatewayRequest
            {
                From = pointFrom,
                To = pointTo,
                Profile = profile,
            });
        feature.Attributes.AddOrUpdate("Name", $"Routing from {@from} to {to} profile type: {profile}");
        feature.Attributes.AddOrUpdate("Creator", "Mapeak");
        return Ok(new FeatureCollection{ feature });
    }

    private static ProfileType ConvertProfile(string type)
    {
        return type switch
        {
            RoutingType.HIKE => ProfileType.Foot,
            RoutingType.BIKE => ProfileType.Bike,
            RoutingType.FOUR_WHEEL_DRIVE => ProfileType.Car4WheelDrive,
            RoutingType.NONE => ProfileType.None,
            _ => ProfileType.Foot
        };
    }

    private Coordinate GetGeographicPosition(string position)
    {
        var split = position.Split(',');
        if (split.Length != 2)
        {
            ModelState.AddModelError("Position", $"Invalid position: {position} format should be number,number");
            return null;
        }
        var lat = double.Parse(split.First());
        var lng = double.Parse(split.Last());
        return new CoordinateZ(lng, lat);
    }

    /// <summary>
    /// Getting a straight line between two points.
    /// Since the elevation resolution is 30 meters there's no need to sample distances that are
    /// less than 30 meters. Maximal total points is 30 to limit the response size.
    /// </summary>
    /// <param name="from"></param>
    /// <param name="to"></param>
    /// <returns></returns>
    private Feature GetDenseStraightLine(Coordinate from, Coordinate to)
    {
        var itmFrom = _wgs84ItmMathTransform.Transform(from.X, from.Y);
        var itmTo = _wgs84ItmMathTransform.Transform(to.X, to.Y);
        var samples = (int)Math.Min(new Point(itmFrom.x, itmFrom.y).Distance(new Point(itmTo.x, itmTo.y)) / 30, 30);
        if (samples == 0)
        {
            return new Feature(_geometryFactory.CreateLineString([from, to]), new AttributesTable());
        }
        var coordinates = Enumerable.Range(0, samples + 1).Select(s => new CoordinateZ(
            (to.X - from.X) * s / samples + from.X,
            (to.Y - from.Y) * s / samples + from.Y,
            0) as Coordinate
        ).ToArray();
        Geometry lineString = _geometryFactory.CreateLineString(coordinates);
        lineString = _elevationSetterExecutor.GeometryTo3D(lineString);
        return new Feature(lineString, new AttributesTable());
    }
}