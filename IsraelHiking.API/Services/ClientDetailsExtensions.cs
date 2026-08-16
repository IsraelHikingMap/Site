using Microsoft.AspNetCore.Http;
using System.Text.RegularExpressions;

namespace IsraelHiking.API.Services;

/// <summary>
/// Helper methods to read the details the client reports about itself in the request headers
/// </summary>
public static class ClientDetailsExtensions
{
    /// <summary>
    /// The header the client uses to report its platform
    /// </summary>
    public const string CLIENT_PLATFORM_HEADER = "X-Client-Platform";

    /// <summary>
    /// The header the app uses to report its version, a browser has no version of its own
    /// </summary>
    public const string CLIENT_VERSION_HEADER = "X-Client-Version";

    /// <summary>
    /// These are user controlled values that end up in a public OSM changeset tag, so only the leading part
    /// that looks like a platform or a version is kept, and the length is limited
    /// </summary>
    private static readonly Regex PlatformPattern = new("^[a-z]{1,16}", RegexOptions.Compiled);
    private static readonly Regex VersionPattern = new(@"^[0-9A-Za-z.\-]{1,32}", RegexOptions.Compiled);

    /// <summary>
    /// Gets the details reported by the client that sent the given request
    /// </summary>
    /// <param name="request"></param>
    /// <returns>The client details, unknown when the client reported nothing, i.e. it predates these headers</returns>
    public static ClientDetails GetClientDetails(this HttpRequest request)
    {
        if (request == null)
        {
            return ClientDetails.Unknown;
        }
        return new ClientDetails(
            GetSanitizedHeader(request, CLIENT_PLATFORM_HEADER, PlatformPattern),
            GetSanitizedHeader(request, CLIENT_VERSION_HEADER, VersionPattern));
    }

    private static string GetSanitizedHeader(HttpRequest request, string headerName, Regex pattern)
    {
        var value = request.Headers[headerName].ToString();
        if (string.IsNullOrWhiteSpace(value))
        {
            return null;
        }
        var match = pattern.Match(value.Trim().ToLowerInvariant());
        return match.Success ? match.Value : null;
    }
}
