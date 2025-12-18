using System.IO;
using System.Net;
using System.Text.RegularExpressions;
using IsraelHiking.Common;
using Microsoft.AspNetCore.Hosting;

namespace IsraelHiking.API.Services;

/// <summary>
/// Small helper to render the index.html file for the crawlers.
/// </summary>
public class HomePageHelper : IHomePageHelper
{
    const string SPLIT_PATTERN = @"<!-- MAPEAK \w+ -->";

    private readonly string _fileHeader;
    private readonly string _fileFooter;

    /// <summary>
    /// Constructor
    /// </summary>
    public HomePageHelper(IWebHostEnvironment environment)
    {
        var indexFileInfo = environment.WebRootFileProvider.GetFileInfo("/index.html");
        using var reader = new StreamReader(indexFileInfo.CreateReadStream());
        var fileContents = reader.ReadToEnd();
        var parts = Regex.Split(fileContents, SPLIT_PATTERN);
        _fileHeader = parts[0];
        _fileFooter = parts[2];
    }


    /// <summary>
    /// Create a homepage with information for crawlers
    /// </summary>
    /// <param name="title"></param>
    /// <param name="description"></param>
    /// <param name="thumbnailUrl"></param>
    /// <param name="language"></param>
    /// <returns></returns>
    public string Render(string title, string description, string thumbnailUrl, string language="")
    {
        title = WebUtility.HtmlEncode(title.Trim());
        title += (string.IsNullOrWhiteSpace(title) ? "" : " | ") + Branding.SITE_NAME;

        description = string.IsNullOrWhiteSpace(description) ? Branding.DESCRIPTION : description.Trim();
        description = WebUtility.HtmlEncode(description);

        var secureThumbUrl = thumbnailUrl.Replace("http://", "https://");
            
        var s = $@"
                    <meta property=""og:title"" content=""{title}"" />
                    <meta property=""og:image"" content=""{thumbnailUrl}"" />
                    <meta property=""og:image:url"" content=""{thumbnailUrl}"" />
                    <meta property=""og:image:secure_url"" content=""{secureThumbUrl}"" />
                    <meta property=""og:description"" content=""{description}"" />
                    <meta name=""title"" content=""{title}"" />
                    <meta name=""description"" content=""{description}"" />
                    <title>{title}</title>
            ";

        return _fileHeader + s + _fileFooter;
    }
}