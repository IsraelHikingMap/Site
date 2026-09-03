using IsraelHiking.DataAccessInterfaces;
using Microsoft.AspNetCore.Http;
using System.Linq;

namespace IsraelHiking.API.Services.Osm;

/// <inheritdoc/>
public class HttpContextOsmAccessTokenProvider(IHttpContextAccessor httpContextAccessor) : IOsmAccessTokenProvider
{
    /// <inheritdoc/>
    public string GetToken()
    {
        return httpContextAccessor.HttpContext?.User.Claims
            .FirstOrDefault(claim => claim.Type == OsmAuthFactoryWrapper.CLAIM_KEY)?.Value;
    }
}
