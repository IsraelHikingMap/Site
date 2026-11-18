using System.Threading.Tasks;

namespace IsraelHiking.DataAccessInterfaces;

/// <summary>
/// Garmin's answer to a request, relayed as is to the client that asked for it.
/// </summary>
/// <param name="StatusCode">The HTTP status code Garmin returned</param>
/// <param name="Content">The JSON body Garmin returned</param>
public record GarminResponse(int StatusCode, string Content);

/// <summary>
/// Calls the Garmin Connect Developer Program API on behalf of a user.
/// </summary>
/// <remarks>
/// Garmin issues no secretless client, and allows its API to be called only from a server, so the token
/// requests, which need this server's client secret, and the calls made with a user's token both go
/// through here rather than from the user's device.
/// </remarks>
public interface IGarminGateway
{
    /// <summary>
    /// Exchanges the authorization code of a user that agreed to connect for an access and a refresh token
    /// </summary>
    /// <param name="code">The code Garmin redirected the user back with</param>
    /// <param name="codeVerifier">The PKCE verifier the code challenge was made of</param>
    /// <param name="redirectUri">The redirect uri the authorization request was made with</param>
    Task<GarminResponse> ExchangeCode(string code, string codeVerifier, string redirectUri);

    /// <summary>
    /// Gets a new access token, and a new refresh token with it, before the access token expires
    /// </summary>
    /// <param name="refreshToken">The last refresh token Garmin returned for the user</param>
    Task<GarminResponse> RefreshToken(string refreshToken);

    /// <summary>
    /// Creates a course in the user's Garmin Connect account, which then syncs to their device
    /// </summary>
    /// <param name="accessToken">The user's access token</param>
    /// <param name="courseJson">The course, in the JSON format of the Courses API</param>
    Task<GarminResponse> CreateCourse(string accessToken, string courseJson);

    /// <summary>
    /// Removes the user's connection to this app, which Garmin requires when the user disconnects in the app
    /// </summary>
    /// <param name="accessToken">The user's access token</param>
    Task<GarminResponse> DeleteRegistration(string accessToken);
}
