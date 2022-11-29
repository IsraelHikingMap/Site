using IsraelHiking.Common;
using IsraelHiking.Common.Configuration;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using OsmSharp.IO.API;
using System;
using System.Security.Claims;
using System.Threading.Tasks;
using IsraelHiking.API.Services;
using IsraelHiking.API.Services.Osm;
using LazyCache;
using Microsoft.AspNetCore.Authentication.JwtBearer;

namespace IsraelHiking.Web
{
    public class OsmAccessTokenEventsHelper
    {
        private readonly ILogger _logger;
        private readonly IClientsFactory _clientsFactory;
        private readonly ConfigurationData _options;
        private readonly IAppCache _appCache;
        public OsmAccessTokenEventsHelper(IClientsFactory clientsFactory,
            IOptions<ConfigurationData> options,
            IAppCache appCache,
            ILogger logger)
        {
            _clientsFactory = clientsFactory;
            _options = options.Value;
            _logger = logger;
            _appCache = appCache;
        }
        
        public async Task OnMessageReceived(MessageReceivedContext context)
        {
            try
            {
                if (string.IsNullOrEmpty(context.Token))
                {
                    string authorization = context.Request.Headers["Authorization"];

                    // If no authorization header found, nothing to process further
                    if (string.IsNullOrEmpty(authorization))
                    {
                        context.Fail(new Exception("Can't find access token - missing Authorization header"));
                        return;
                    }

                    if (authorization.StartsWith("Bearer ", StringComparison.OrdinalIgnoreCase))
                    {
                        context.Token = authorization.Substring("Bearer ".Length).Trim();
                    }

                    // If no token found, no further work possible
                    if (string.IsNullOrEmpty(context.Token))
                    {
                        context.Fail(new Exception("Can't find access token - Bearer is missing"));
                        return;
                    }
                }

                var userIdFromCache = await _appCache.GetOrAdd(context.Token, async () =>
                {
                    var osmGateway = OsmAuthFactoryWrapper.ClientFromToken(context.Token, _clientsFactory, _options);
                    var user = await osmGateway.GetUserDetails();
                    var userId = user.Id.ToString();
                    _logger.LogInformation($"User {userId} had just logged in");
                    return userId;
                }, TimeSpan.FromMinutes(30));
                
                var identity = new ClaimsIdentity("Osm");
                identity.AddClaim(new Claim(ClaimTypes.NameIdentifier, userIdFromCache));
                identity.AddClaim(new Claim(ClaimTypes.Name, userIdFromCache));
                identity.AddClaim(new Claim(OsmAuthFactoryWrapper.CLAIM_KEY, context.Token));
                context.Principal = new ClaimsPrincipal(identity);
                context.Success();
            }
            catch (Exception ex)
            {
                context.Fail(ex);    
            }
        }
    }
}