using System.Linq;
using System.Security.Claims;
using System.Threading.Tasks;
using IsraelHiking.API.Services;
using Microsoft.Owin.Security;
using Microsoft.Owin.Security.Infrastructure;

namespace IsraelHiking.Web
{
    public class OsmAccessTokenProvider : AuthenticationTokenProvider
    {
        private readonly IOsmUserCache _osmUserCache;

        public OsmAccessTokenProvider(IOsmUserCache osmUserCache)
        {
            _osmUserCache = osmUserCache;
        }

        public override async Task ReceiveAsync(AuthenticationTokenReceiveContext context)
        {
            var token = context.Token.Split(';').First().Trim('"');
            var tokenSecret = context.Token.Split(';').Last().Trim('"');
            var userId = await _osmUserCache.GetUserId(token, tokenSecret);
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