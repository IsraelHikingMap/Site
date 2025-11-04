using Microsoft.AspNetCore.Mvc;
using System.Linq;
using System;

namespace IsraelHiking.API.Controllers;

/// <summary>
/// This controller allows elevation queries
/// </summary>
[Route("api/[controller]")]
[Obsolete("Remove by 1.2026")]
public class ElevationController : ControllerBase
{
    /// <summary>
    /// Controller's constructor
    /// </summary>
    public ElevationController()
    {
    }

    /// <summary>
    /// Get elevation for the given points.
    /// </summary>
    /// <param name="points">The points array - each point should be latitude,longitude and use '|' to separate between points</param>
    /// <returns>An array of elevation values according to given points order</returns>
    [HttpGet]
    public double[] GetElevation(string points)
    {
        return points.Split('|').Select(p => { return (double)0; }).ToArray();
    }
        
    /// <summary>
    /// Get elevation for the given points.
    /// </summary>
    /// <param name="points">The points array - each point should be latitude,longitude array</param>
    /// <returns>An array of elevation values according to given points order</returns>
    [HttpPost]
    public double[] GetElevation([FromBody] double[][] points)
    {
        return points.Select(p => (double)0).ToArray();
    }
}