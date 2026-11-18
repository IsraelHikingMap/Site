using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using IsraelHiking.DataAccessInterfaces;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;

namespace IsraelHiking.API.Controllers;

/// <summary>
/// This controller does the parts of the Garmin login that need a server
/// </summary>
/// <remarks>
/// Garmin's token requests need this server's client secret, and Garmin allows a single redirect uri for both the
/// app and the site. Everything else goes through the nginx pass-through, the same as for Wahoo.
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
    /// The client marks the state with where the request came from. A redirect from the server, unlike one from a
    /// page's script, is allowed to open the app from the browser.
    /// </remarks>
    /// <returns>A redirect to the app's callback or to the site's callback page, with Garmin's parameters</returns>
    [HttpGet("callback")]
    public IActionResult GetCallback()
    {
        var target = Request.Query["state"].ToString().StartsWith(APP_STATE_PREFIX) ? APP_CALLBACK : SITE_CALLBACK;
        return Redirect(target + Request.QueryString.Value);
    }

    /// <summary>
    /// Garmin's token endpoint, with this server's client credentials added
    /// </summary>
    /// <param name="form">A standard OAuth token request - an authorization code exchange or a refresh</param>
    /// <returns>Garmin's token response</returns>
    [HttpPost("token")]
    [Consumes("application/x-www-form-urlencoded")]
    public async Task<IActionResult> PostToken([FromForm] IFormCollection form)
    {
        var response = await garminGateway.RequestToken(form.Select(p => new KeyValuePair<string, string>(p.Key, p.Value.ToString())));
        return new ContentResult
        {
            StatusCode = response.StatusCode,
            Content = response.Content,
            ContentType = "application/json"
        };
    }
}
