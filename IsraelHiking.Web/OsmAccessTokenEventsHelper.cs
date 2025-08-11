using Microsoft.Extensions.Logging;
using OsmSharp.IO.API;
using System;
using System.Security.Claims;
using System.Threading.Tasks;
using IsraelHiking.API.Services.Osm;
using LazyCache;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http;

namespace IsraelHiking.Web;

public class OsmAccessTokenEventsHelper
{
    private readonly ILogger _logger;
    private readonly IClientsFactory _clientsFactory;
    private readonly IAppCache _appCache;
    public OsmAccessTokenEventsHelper(IClientsFactory clientsFactory,
        IAppCache appCache,
        ILogger logger)
    {
        _clientsFactory = clientsFactory;
        _logger = logger;
        _appCache = appCache;
    }
        
    public async Task OnMessageReceived(MessageReceivedContext context)
    {
        try
        {
            var token = context.Token;
            if (string.IsNullOrEmpty(token))
            {
                string authorization = context.Request.Headers["Authorization"];
                if (!string.IsNullOrEmpty(authorization) && authorization.StartsWith("Bearer ", StringComparison.OrdinalIgnoreCase))
                {
                    token = authorization.Substring("Bearer ".Length).Trim();
                }
            }

            var needToCheckToken = context.HttpContext.GetEndpoint()?.Metadata.GetMetadata<IAuthorizeData>() != null;
            if (!needToCheckToken) 
            {
                context.Success();
                return;
            }

            if (string.IsNullOrEmpty(token))
            {
                context.Fail("Token is missing for authorized route");
                return;
            }
                
            var userIdFromCache = await _appCache.GetOrAddAsync(token, async () =>
            {
                var osmGateway = _clientsFactory.CreateOAuth2Client(token);
                var user = await osmGateway.GetUserDetails();
                var userId = user.Id.ToString();
                _logger.LogInformation($"User {userId} had just logged in");
                return userId;
            }, TimeSpan.FromMinutes(30));
            var identity = new ClaimsIdentity("Osm");
            identity.AddClaim(new Claim(ClaimTypes.NameIdentifier, userIdFromCache));
            identity.AddClaim(new Claim(ClaimTypes.Name, userIdFromCache));
            identity.AddClaim(new Claim(OsmAuthFactoryWrapper.CLAIM_KEY, token));
            context.Principal = new ClaimsPrincipal(identity);
            context.Success();
        }
        catch (Exception ex)
        {
            context.Fail(ex);    
        }
    }
}