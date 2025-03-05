using System.Linq;
using System.Security.Claims;
using OsmSharp.IO.API;

namespace IsraelHiking.API.Services.Osm;

/// <summary>
/// A simple class to help with creating OSM authenticated gateway
/// </summary>
public static class OsmAuthFactoryWrapper
{
    /// <summary>
    /// The OSM token key in the claims
    /// </summary>
    public const string CLAIM_KEY = "osm_token";

    /// <summary>
    /// Creates a client based on the given parameters, mainly how the token is built, which is inside the user parameter
    /// </summary>
    /// <param name="user"></param>
    /// <param name="clientsFactory"></param>
    /// <returns></returns>
    public static IAuthClient ClientFromUser(ClaimsPrincipal user, IClientsFactory clientsFactory)
    {
        var token = user.Claims.FirstOrDefault(c => c.Type == CLAIM_KEY)?.Value;
        return clientsFactory.CreateOAuth2Client(token);
    }
}