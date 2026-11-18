using System.Threading.Tasks;
using IsraelHiking.Common.Api;
using IsraelHiking.DataAccessInterfaces;
using Microsoft.AspNetCore.Mvc;

namespace IsraelHiking.API.Controllers;

/// <summary>
/// This controller lets a user send a route to their Garmin device
/// </summary>
/// <remarks>
/// Garmin requires its client secret to stay on a server and its API to be called only from one, so the
/// client opens Garmin's consent page itself and does everything after that through here. Nothing is stored:
/// the user's tokens are returned to their device, and Garmin's answers are relayed as they are.
/// </remarks>
[Route("api/[controller]")]
[ApiController]
public class GarminController(IGarminGateway garminGateway) : ControllerBase
{
    private const string APP_STATE_PREFIX = "app-";
    private const string APP_CALLBACK = "mapeak://oauth_callback/";
    private const string SITE_CALLBACK = "/device-oauth.html";

    /// <summary>
    /// The page Garmin sends the user back to after the consent page, which hands the result on to the app or to the site
    /// </summary>
    /// <remarks>
    /// Garmin allows a single redirect uri, while the app and the site each need their own to catch the result.
    /// The client marks the state with where the request came from, and a redirect from the server, unlike one
    /// from a page's script, is allowed to open the app from the browser.
    /// </remarks>
    /// <returns>A redirect to the app's callback or to the site's callback page, with Garmin's parameters</returns>
    [HttpGet("callback")]
    public IActionResult GetCallback()
    {
        var query = Request.QueryString.Value ?? "";
        var target = Request.Query["state"].ToString().StartsWith(APP_STATE_PREFIX)
            ? APP_CALLBACK
            : SITE_CALLBACK;
        return Redirect(target + query);
    }

    /// <summary>
    /// Exchanges an authorization code for tokens
    /// </summary>
    /// <param name="request">The code and the PKCE verifier</param>
    /// <returns>Garmin's token response</returns>
    [HttpPost("token")]
    public async Task<IActionResult> PostToken([FromBody] GarminCodeExchangeRequest request)
    {
        return Relay(await garminGateway.ExchangeCode(request.Code, request.CodeVerifier, request.RedirectUri));
    }

    /// <summary>
    /// Replaces an access token that is about to expire
    /// </summary>
    /// <param name="request">The last refresh token</param>
    /// <returns>Garmin's token response</returns>
    [HttpPost("refresh")]
    public async Task<IActionResult> PostRefresh([FromBody] GarminRefreshRequest request)
    {
        return Relay(await garminGateway.RefreshToken(request.RefreshToken));
    }

    /// <summary>
    /// Creates a course in the user's Garmin Connect account
    /// </summary>
    /// <param name="request">The user's access token and the course</param>
    /// <returns>Garmin's response</returns>
    [HttpPost("course")]
    public async Task<IActionResult> PostCourse([FromBody] GarminCourseRequest request)
    {
        return Relay(await garminGateway.CreateCourse(request.AccessToken, request.Course.GetRawText()));
    }

    /// <summary>
    /// Disconnects the user's Garmin Connect account from this app
    /// </summary>
    /// <param name="request">The user's access token</param>
    /// <returns>Garmin's response</returns>
    [HttpPost("disconnect")]
    public async Task<IActionResult> PostDisconnect([FromBody] GarminUserRequest request)
    {
        return Relay(await garminGateway.DeleteRegistration(request.AccessToken));
    }

    private static ContentResult Relay(GarminResponse response)
    {
        return new ContentResult
        {
            StatusCode = response.StatusCode,
            Content = response.Content,
            ContentType = "application/json"
        };
    }
}
