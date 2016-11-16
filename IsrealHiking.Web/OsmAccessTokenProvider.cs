using System.Linq;
using System.Net;
using System.Net.Http;
using System.Net.Http.Headers;
using System.Security.Claims;
using System.Threading.Tasks;
using System.Xml.Linq;
using Microsoft.Owin.Security;
using Microsoft.Owin.Security.Infrastructure;
using OAuth;

namespace IsraelHiking.Web
{
    public class OsmAccessTokenProvider : AuthenticationTokenProvider
    {
        public override async Task ReceiveAsync(AuthenticationTokenReceiveContext context)
        {
            using (var client = new HttpClient())
            {
                var request = new OAuthRequest
                {
                    ConsumerKey = "H5Us9nv9eDyFpKbBTiURf7ZqfdBArNddv10n6R6U",
                    ConsumerSecret = "ccYaQUKLz26XEzbNd8uWoQ6HwbcnrUUp8milXnXG",
                    Token = context.Token.Split(';').First().Trim('"'),
                    TokenSecret = context.Token.Split(';').Last().Trim('"'),
                    Type = OAuthRequestType.ProtectedResource,
                    SignatureMethod = OAuthSignatureMethod.HmacSha1,
                    RequestUrl = "https://www.openstreetmap.org/api/0.6/user/details",
                    Version = "1.0",
                    Method = "GET"
                };
                var auth = request.GetAuthorizationHeader().Replace("OAuth ", "");
                client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("OAuth", auth);
                var response = await client.GetAsync(request.RequestUrl);
                if (response.StatusCode != HttpStatusCode.OK)
                {
                    return;
                }
                var osmUserDetailsSteam = await response.Content.ReadAsStreamAsync();
                var doc = XDocument.Load(osmUserDetailsSteam);
                var userId = doc.Descendants().Where(x => x.Name.LocalName == "user").Attributes().FirstOrDefault(a => a.Name == "id")?.Value;
                var identity = new ClaimsIdentity("Osm");
                identity.AddClaim(new Claim(ClaimTypes.NameIdentifier, userId));
                identity.AddClaim(new Claim(ClaimTypes.Name, userId));

                context.SetTicket(new AuthenticationTicket(identity, new AuthenticationProperties()));
            }
        }
    }
}