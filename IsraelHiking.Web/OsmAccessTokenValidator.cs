using System.Linq;
using System.Security.Claims;
using IsraelHiking.API.Services;
using IsraelHiking.Common;
using IsraelHiking.DataAccessInterfaces;
using Microsoft.Extensions.Logging;
using Microsoft.IdentityModel.Tokens;
using System;
using System.IdentityModel.Tokens.Jwt;

namespace IsraelHiking.Web
{
    public class OsmAccessTokenValidator : ISecurityTokenValidator
    {
        private readonly ILogger _logger;
        private readonly IHttpGatewayFactory _httpGatewayFactory;
        private readonly LruCache<string, TokenAndSecret> _cache;

        public OsmAccessTokenValidator(IHttpGatewayFactory httpGatewayFactory,
            LruCache<string, TokenAndSecret> cache,
            ILogger logger)
        {
            _httpGatewayFactory = httpGatewayFactory;
            _cache = cache;
            _logger = logger;
        }

        public bool CanValidateToken => true;

        public int MaximumTokenSizeInBytes { get; set; }

        public bool CanReadToken(string securityToken)
        {
            return securityToken.Contains(";");
        }

        public ClaimsPrincipal ValidateToken(string securityToken, TokenValidationParameters validationParameters, out SecurityToken validatedToken)
        {
            var token = securityToken.Split(';').First().Trim('"');
            var tokenSecret = securityToken.Split(';').Last().Trim('"');
            var tokenAndSecret = new TokenAndSecret(token, tokenSecret);
            var userId = _cache.ReverseGet(tokenAndSecret);
            if (string.IsNullOrEmpty(userId))
            {
                var osmGateway = _httpGatewayFactory.CreateOsmGateway(tokenAndSecret);
                userId = osmGateway.GetUserId().Result;
                _logger.LogInformation("User " + userId + " had just logged in");
                _cache.Add(userId, tokenAndSecret);
            }
            validatedToken = new JwtSecurityToken();
            if (string.IsNullOrWhiteSpace(userId))
            {
                throw new ArgumentException("Invalid user id", nameof(securityToken));
            }
            ClaimsIdentity identity = new ClaimsIdentity("Osm");
            identity.AddClaim(new Claim(ClaimTypes.NameIdentifier, userId));
            identity.AddClaim(new Claim(ClaimTypes.Name, userId));

            return new ClaimsPrincipal(identity);
        }
    }
}