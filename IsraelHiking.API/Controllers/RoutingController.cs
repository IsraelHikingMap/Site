using IsraelHiking.Common.Api;
using IsraelHiking.Common.DataContainer;
using IsraelHiking.Common.Extensions;
using IsraelHiking.DataAccessInterfaces;
using Microsoft.AspNetCore.Mvc;
using NetTopologySuite.Features;
using NetTopologySuite.Geometries;
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

    /// <summary>
    /// Controller's constructor
    /// </summary>
    /// <param name="graphHopperGateway"></param>
    public RoutingController(IGraphHopperGateway graphHopperGateway)
    {
        _graphHopperGateway = graphHopperGateway;
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
        var feature = await _graphHopperGateway.GetRouting(new RoutingGatewayRequest
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
}