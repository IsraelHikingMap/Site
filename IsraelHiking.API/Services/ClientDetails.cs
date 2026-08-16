using System.Linq;

namespace IsraelHiking.API.Services;

/// <summary>
/// The platform and version of the client that sent a request, as it reported them
/// </summary>
/// <param name="Platform">The platform, i.e. web, android or ios, null when the client did not report it</param>
/// <param name="Version">The client version, null when the client did not report it, which a browser never does</param>
public record ClientDetails(string Platform, string Version)
{
    private static readonly string[] MobilePlatforms = ["android", "ios"];

    private const string APP = "app";

    /// <summary>
    /// Nothing is known about the client, i.e. a background process or a client that predates these headers
    /// </summary>
    public static readonly ClientDetails Unknown = new(null, null);

    /// <summary>
    /// The client's details for the logs, i.e. "android 9.21.2"
    /// </summary>
    public string Info => Describe(Platform);

    /// <summary>
    /// The client's details for an OSM changeset. Such a changeset is tied to the user's OSM account, so the
    /// specific mobile platform is generalized in order not to publish which phone that user carries.
    /// </summary>
    public string OsmInfo => Describe(MobilePlatforms.Contains(Platform) ? APP : Platform);

    private string Describe(string platform)
    {
        return string.Join(" ", new[] { platform, Version }.Where(part => !string.IsNullOrWhiteSpace(part)));
    }
}
