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
/// See the OAuth2 PKCE specification and the Courses API documentation in the Garmin developer portal.
/// </remarks>
public class GarminGateway(
    IHttpClientFactory httpClientFactory,
    IOptions<NonPublicConfigurationData> options)
    : IGarminGateway
{
    private const string TOKEN_ADDRESS = "https://diauth.garmin.com/di-oauth2-service/oauth/token";
    private const string COURSES_ADDRESS = "https://apis.garmin.com/training-api/courses/v1/course";
    private const string REGISTRATION_ADDRESS = "https://apis.garmin.com/partner-gateway/rest/user/registration";

    private readonly NonPublicConfigurationData _options = options.Value;

    /// <inheritdoc/>
    public Task<GarminResponse> ExchangeCode(string code, string codeVerifier, string redirectUri)
    {
        return RequestToken(new Dictionary<string, string>
        {
            { "grant_type", "authorization_code" },
            { "code", code },
            { "code_verifier", codeVerifier },
            { "redirect_uri", redirectUri }
        });
    }

    /// <inheritdoc/>
    public Task<GarminResponse> RefreshToken(string refreshToken)
    {
        return RequestToken(new Dictionary<string, string>
        {
            { "grant_type", "refresh_token" },
            { "refresh_token", refreshToken }
        });
    }

    /// <inheritdoc/>
    public Task<GarminResponse> CreateCourse(string accessToken, string courseJson)
    {
        var request = new HttpRequestMessage(HttpMethod.Post, COURSES_ADDRESS)
        {
            Content = new StringContent(courseJson, Encoding.UTF8, "application/json")
        };
        return Send(request, accessToken);
    }

    /// <inheritdoc/>
    public Task<GarminResponse> DeleteRegistration(string accessToken)
    {
        return Send(new HttpRequestMessage(HttpMethod.Delete, REGISTRATION_ADDRESS), accessToken);
    }

    private Task<GarminResponse> RequestToken(Dictionary<string, string> parameters)
    {
        parameters["client_id"] = _options.GarminClientId;
        parameters["client_secret"] = _options.GarminClientSecret;
        var request = new HttpRequestMessage(HttpMethod.Post, TOKEN_ADDRESS)
        {
            Content = new FormUrlEncodedContent(parameters)
        };
        return Send(request, null);
    }

    private async Task<GarminResponse> Send(HttpRequestMessage request, string accessToken)
    {
        var client = httpClientFactory.CreateClient();
        client.DefaultRequestHeaders.UserAgent.ParseAdd(Branding.USER_AGENT);
        if (accessToken != null)
        {
            request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", accessToken);
        }
        var response = await client.SendAsync(request);
        return new GarminResponse((int)response.StatusCode, await response.Content.ReadAsStringAsync());
    }
}
