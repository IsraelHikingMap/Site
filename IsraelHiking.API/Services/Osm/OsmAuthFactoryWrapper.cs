using System.Linq;
using System.Security.Claims;
using IsraelHiking.Common.Configuration;
using OsmSharp.IO.API;

namespace IsraelHiking.API.Services.Osm
{
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
        /// Creates a client based on the given parameters, mainly how the token is built
        /// </summary>
        /// <param name="token"></param>
        /// <param name="clientsFactory"></param>
        /// <param name="options"></param>
        /// <returns></returns>
        public static IAuthClient ClientFromToken(string token, IClientsFactory clientsFactory, ConfigurationData options)
        {
            if (!token.Contains(";"))
            {
                return clientsFactory.CreateOAuth2Client(token);
            }
            var split = token.Split(';');
            var tokenPart = split.First().Trim('"');
            var tokenSecret = split.Last().Trim('"');
            return clientsFactory.CreateOAuthClient(options.OsmConfiguration.ConsumerKey,
                options.OsmConfiguration.ConsumerSecret, tokenPart, tokenSecret);

        }

        /// <summary>
        /// Creates a client based on the given parameters, mainly how the token is built, which is inside the user parameter
        /// </summary>
        /// <param name="user"></param>
        /// <param name="clientsFactory"></param>
        /// <param name="options"></param>
        /// <returns></returns>
        public static IAuthClient ClientFromUser(ClaimsPrincipal user, IClientsFactory clientsFactory,
            ConfigurationData options)
        {
            var tokenAndSecret = user.Claims.FirstOrDefault(c => c.Type == CLAIM_KEY)?.Value;
            return ClientFromToken(tokenAndSecret, clientsFactory, options);
        }
    }
}