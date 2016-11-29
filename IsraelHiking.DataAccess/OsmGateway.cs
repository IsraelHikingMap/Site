using System.Net.Http;
using System.Net.Http.Headers;
using System.Threading.Tasks;
using IsraelHiking.DataAccessInterfaces;
using OAuth;

namespace IsraelHiking.DataAccess
{
    public class OsmGateway : IOsmGateway
    {
        public async Task<HttpResponseMessage> Get(string url, string token, string tokenSecret)
        {
            using (var client = new HttpClient())
            {
                var request = new OAuthRequest
                {
                    ConsumerKey = "H5Us9nv9eDyFpKbBTiURf7ZqfdBArNddv10n6R6U",
                    ConsumerSecret = "ccYaQUKLz26XEzbNd8uWoQ6HwbcnrUUp8milXnXG",
                    Token = token,
                    TokenSecret = tokenSecret,
                    Type = OAuthRequestType.ProtectedResource,
                    SignatureMethod = OAuthSignatureMethod.HmacSha1,
                    RequestUrl = url,
                    Version = "1.0",
                    Method = "GET"
                };
                var auth = request.GetAuthorizationHeader().Replace("OAuth ", "");
                client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("OAuth", auth);
                return await client.GetAsync(request.RequestUrl);
            }
        }
    }
}
