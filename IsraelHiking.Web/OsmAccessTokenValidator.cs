using IsraelHiking.API.Services;
using IsraelHiking.Common;
using IsraelHiking.Common.Configuration;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using Microsoft.IdentityModel.Tokens;
using OsmSharp.IO.API;
using System;
using System.IdentityModel.Tokens.Jwt;
using System.Linq;
using System.Security.Claims;

namespace IsraelHiking.Web
{
    public class OsmAccessTokenValidator : ISecurityTokenValidator
    {
        private readonly ILogger _logger;
        private readonly IClientsFactory _clientsFactory;
        private readonly UsersIdAndTokensCache _cache;
        private readonly ConfigurationData _options;

        public OsmAccessTokenValidator(IClientsFactory clientsFactory,
            IOptions<ConfigurationData> options,
            UsersIdAndTokensCache cache,
            ILogger logger)
        {
            _clientsFactory = clientsFactory;
            _cache = cache;
            _options = options.Value;
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
            var userId = string.Empty;
            // https://www.tabsoverspaces.com/233703-named-locks-using-monitor-in-net-implementation/
            // https://stackoverflow.com/questions/55188959/what-are-the-options-for-named-locks-in-net-core
            lock (string.Intern(tokenAndSecret.ToString()))
            {
                userId = _cache.ReverseGet(tokenAndSecret);
                if (string.IsNullOrEmpty(userId))
                {
                    var osmGateway = _clientsFactory.CreateOAuthClient(_options.OsmConfiguration.ConsumerKey, _options.OsmConfiguration.ConsumerSecret, tokenAndSecret.Token, tokenAndSecret.TokenSecret);
                    var user = osmGateway.GetUserDetails().Result;
                    userId = user.Id.ToString();
                    _logger.LogInformation($"User {userId} had just logged in");
                    _cache.Add(userId, tokenAndSecret);
                }
            }
            validatedToken = new JwtSecurityToken();
            if (string.IsNullOrWhiteSpace(userId))
            {
                throw new ArgumentException("Invalid user id", nameof(securityToken));
            }
            var identity = new ClaimsIdentity("Osm");
            identity.AddClaim(new Claim(ClaimTypes.NameIdentifier, userId));
            identity.AddClaim(new Claim(ClaimTypes.Name, userId));
            
            return new ClaimsPrincipal(identity);
        }
    }
}