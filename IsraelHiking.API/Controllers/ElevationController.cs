using IsraelHiking.Common.Extensions;
using IsraelHiking.DataAccessInterfaces;
using Microsoft.AspNetCore.Mvc;
using System.Linq;
using System.Threading.Tasks;
using NetTopologySuite.Geometries;

namespace IsraelHiking.API.Controllers;

/// <summary>
/// This controller allows elevation queries
/// </summary>
[Route("api/[controller]")]
public class ElevationController : ControllerBase
{
    private readonly IElevationGateway _elevationGateway;

    /// <summary>
    /// Controller's constructor
    /// </summary>
    /// <param name="elevationGateway"></param>
    public ElevationController(IElevationGateway elevationGateway)
    {
        _elevationGateway = elevationGateway;
    }

    /// <summary>
    /// Get elevation for the given points.
    /// </summary>
    /// <param name="points">The points array - each point should be latitude,longitude and use '|' to separate between points</param>
    /// <returns>An array of elevation values according to given points order</returns>
    [HttpGet]
    public Task<double[]> GetElevation(string points)
    {
        return _elevationGateway.GetElevation(points.Split('|').Select(p => p.ToCoordinate()).ToArray());
    }
        
    /// <summary>
    /// Get elevation for the given points.
    /// </summary>
    /// <param name="points">The points array - each point should be latitude,longitude array</param>
    /// <returns>An array of elevation values according to given points order</returns>
    [HttpPost]
    public Task<double[]> GetElevation([FromBody] double[][] points)
    {
        return _elevationGateway.GetElevation(points.Select(p => new Coordinate(p[0], p[1])).ToArray());
    }
}