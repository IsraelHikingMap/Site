using System;
using System.Collections.Generic;
using System.Net.Http;
using System.Net.Http.Headers;
using System.Text;
using System.Threading.Tasks;
using IsraelHiking.Common;
using IsraelHiking.Common.Configuration;
using IsraelHiking.DataAccessInterfaces;
using Microsoft.Extensions.Options;

namespace IsraelHiking.DataAccess;

/// <inheritdoc/>
/// <remarks>
/// See the OAuth2 PKCE specification in the Garmin developer portal.
/// </remarks>
public class GarminGateway(
    IHttpClientFactory httpClientFactory,
    IOptions<NonPublicConfigurationData> options)
    : IGarminGateway
{
    private const string TOKEN_ADDRESS = "https://diauth.garmin.com/di-oauth2-service/oauth/token";

    private readonly NonPublicConfigurationData _options = options.Value;

    /// <inheritdoc/>
    public Task<HttpResponseMessage> RequestToken(IEnumerable<KeyValuePair<string, string>> parameters)
    {
        var client = httpClientFactory.CreateClient();
        client.DefaultRequestHeaders.UserAgent.ParseAdd(Branding.USER_AGENT);
        var credentials = Convert.ToBase64String(Encoding.UTF8.GetBytes($"{_options.GarminClientId}:{_options.GarminClientSecret}"));
        var request = new HttpRequestMessage(HttpMethod.Post, TOKEN_ADDRESS)
        {
            Content = new FormUrlEncodedContent(parameters)
        };
        request.Headers.Authorization = new AuthenticationHeaderValue("Basic", credentials);
        return client.SendAsync(request);
    }
}
