using System.Linq;
using System.Security.Claims;
using System.Threading.Tasks;
using IsraelHiking.API.Services;
using IsraelHiking.Common;
using IsraelHiking.DataAccessInterfaces;
using Microsoft.Owin.Security;
using Microsoft.Owin.Security.Infrastructure;

namespace IsraelHiking.Web
{
    public class OsmAccessTokenProvider : AuthenticationTokenProvider
    {
        private readonly IHttpGatewayFactory _httpGatewayFactory;
        private readonly LruCache<string, TokenAndSecret> _cache;

        public OsmAccessTokenProvider(IHttpGatewayFactory httpGatewayFactory, LruCache<string, TokenAndSecret> cache)
        {
            _httpGatewayFactory = httpGatewayFactory;
            _cache = cache;
        }

        public override async Task ReceiveAsync(AuthenticationTokenReceiveContext context)
        {
            var token = context.Token.Split(';').First().Trim('"');
            var tokenSecret = context.Token.Split(';').Last().Trim('"');
            var tokenAndSecret = new TokenAndSecret(token, tokenSecret);
            var userId = _cache.ReverseGet(tokenAndSecret);
            if (string.IsNullOrEmpty(userId))
            {
                var osmGateway = _httpGatewayFactory.CreateOsmGateway(tokenAndSecret);
                userId = await osmGateway.GetUserId();
                _cache.Add(userId, tokenAndSecret);
            }
            if (string.IsNullOrWhiteSpace(userId))
            {
                return;
            }
            var identity = new ClaimsIdentity("Osm");
            identity.AddClaim(new Claim(ClaimTypes.NameIdentifier, userId));
            identity.AddClaim(new Claim(ClaimTypes.Name, userId));

            context.SetTicket(new AuthenticationTicket(identity, new AuthenticationProperties()));
        }
    }
}