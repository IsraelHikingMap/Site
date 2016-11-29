using System.Linq;
using System.Net;
using System.Net.Http;
using System.Net.Http.Headers;
using System.Threading.Tasks;
using System.Xml.Linq;
using IsraelHiking.Common;
using IsraelHiking.DataAccessInterfaces;
using OAuth;

namespace IsraelHiking.DataAccess.Osm
{
    public class OsmGateway : BaseFileFetcherGateway, IOsmGateway
    {
        private readonly TokenAndSecret _tokenAndSecret;
        private const string OSM_ADDRESS = "www.openstreetmap.org";
        private const string OSM_USER_DETAILS_ADDRESS = "https://" + OSM_ADDRESS + "/api/0.6/user/details";
        public OsmGateway(TokenAndSecret tokenAndSecret, ILogger logger) : base(logger)
        {
            _tokenAndSecret = tokenAndSecret;
        }

        protected override void UpdateHeaders(HttpClient client, string url)
        {
            if (url.Contains(OSM_ADDRESS) == false)
            {
                return;
            }

            var request = new OAuthRequest
            {
                ConsumerKey = "H5Us9nv9eDyFpKbBTiURf7ZqfdBArNddv10n6R6U",
                ConsumerSecret = "ccYaQUKLz26XEzbNd8uWoQ6HwbcnrUUp8milXnXG",
                Token = _tokenAndSecret.Token,
                TokenSecret = _tokenAndSecret.TokenSecret,
                Type = OAuthRequestType.ProtectedResource,
                SignatureMethod = OAuthSignatureMethod.HmacSha1,
                RequestUrl = url,
                Version = "1.0",
                Method = "GET"
            };
            var auth = request.GetAuthorizationHeader().Replace("OAuth ", "");
            client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("OAuth", auth);
        }

        public async Task<string> GetUserId()
        {
            using (var client = new HttpClient())
            {
                UpdateHeaders(client, OSM_USER_DETAILS_ADDRESS);
                var response = await client.GetAsync(OSM_USER_DETAILS_ADDRESS);
                if (response.StatusCode != HttpStatusCode.OK)
                {
                    return string.Empty;
                }
                var osmUserDetailsSteam = response.Content.ReadAsStreamAsync().Result;
                var doc = XDocument.Load(osmUserDetailsSteam);
                var userId = doc.Descendants()
                    .Where(x => x.Name.LocalName == "user")
                    .Attributes()
                    .FirstOrDefault(a => a.Name == "id")?.Value;
                return userId;
            }
        }
    }
}
