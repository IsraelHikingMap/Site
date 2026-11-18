using System.Text.Json;

namespace IsraelHiking.Common.Api;

/// <summary>
/// The result of a user agreeing to connect their Garmin Connect account, to exchange for tokens
/// </summary>
public class GarminCodeExchangeRequest
{
    /// <summary>
    /// The code Garmin redirected the user back with
    /// </summary>
    public string Code { get; set; }
    /// <summary>
    /// The PKCE verifier the code challenge was made of
    /// </summary>
    public string CodeVerifier { get; set; }
    /// <summary>
    /// The redirect uri the authorization request was made with
    /// </summary>
    public string RedirectUri { get; set; }
}

/// <summary>
/// A request to replace a Garmin access token that is about to expire
/// </summary>
public class GarminRefreshRequest
{
    /// <summary>
    /// The last refresh token Garmin returned for the user
    /// </summary>
    public string RefreshToken { get; set; }
}

/// <summary>
/// A request made with the access token of a user's Garmin Connect account
/// </summary>
/// <remarks>
/// The token is sent in the body and not in the Authorization header, which carries the user's own
/// token for this site.
/// </remarks>
public class GarminUserRequest
{
    /// <summary>
    /// The user's Garmin access token
    /// </summary>
    public string AccessToken { get; set; }
}

/// <summary>
/// A course to create in a user's Garmin Connect account
/// </summary>
public class GarminCourseRequest : GarminUserRequest
{
    /// <summary>
    /// The course, in the JSON format of the Garmin Courses API, relayed as is
    /// </summary>
    public JsonElement Course { get; set; }
}
