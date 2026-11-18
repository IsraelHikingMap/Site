using IsraelHiking.API.Services;
using IsraelHiking.Common.Api;
using OsmSharp.IO.API;
using System.Threading.Tasks;

namespace IsraelHiking.API.Executors;

/// <summary>
/// Allows adding a simple point to OSM
/// </summary>
public interface ISimplePointAdderExecutor
{
    /// <summary>
    /// Adds a simple point. If the point is a gate then add it to an existing road
    /// </summary>
    /// <param name="osmGateway"></param>
    /// <param name="request"></param>
    /// <param name="clientDetails">The details of the client that requested the change, unknown when not given</param>
    /// <returns></returns>
    Task Add(IAuthClient osmGateway, AddSimplePointOfInterestRequest request, ClientDetails clientDetails = null);
}