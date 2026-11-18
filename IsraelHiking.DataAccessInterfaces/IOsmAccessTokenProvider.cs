namespace IsraelHiking.DataAccessInterfaces;

/// <summary>
/// Provides the OSM access token of the user the current request is handled for
/// </summary>
/// <remarks>
/// A gateway that uploads on behalf of the user rather than on behalf of the site needs that user's
/// token. The data access layer knows nothing about requests, so the layer that does supplies it here.
/// </remarks>
public interface IOsmAccessTokenProvider
{
    /// <summary>
    /// Gets the token of the user of the current request
    /// </summary>
    /// <returns>The token, or null when the request has no authenticated user</returns>
    string GetToken();
}
