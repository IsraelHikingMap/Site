using System;
using Microsoft.Extensions.FileProviders;
using System.IO;
using System.Net;
using System.Text.RegularExpressions;
using IsraelHiking.Common;
using Microsoft.AspNetCore.Hosting;
using Trace = System.Diagnostics.Trace;

namespace IsraelHiking.API.Services
{
    /// <summary>
    /// Small helper to render the index.html file for the crawlers.
    /// </summary>
    public class HomePageHelper : IHomePageHelper
    {
        const string splitPattern = @"<!-- IHM \w+ -->";
        
        private readonly IFileInfo _fileInfo;
        private readonly string _fileContents;
        private readonly string _fileHeader;
        private readonly string _fileFooter;

        /// <summary>
        /// Constructor
        /// </summary>
        public HomePageHelper(IWebHostEnvironment environment)
        {
            _fileInfo = environment.WebRootFileProvider.GetFileInfo("/index.html");
            using (var reader = new StreamReader(_fileInfo.CreateReadStream()))
            {
                _fileContents = reader.ReadToEnd();
            }
            var parts = Regex.Split(_fileContents, splitPattern);
            Trace.Assert(parts.Length == 3, String.Format("Bad number of parts: {0}", parts.Length));
            _fileHeader = parts[0];
            _fileFooter = parts[2];
        }

        public IFileInfo GetFileInfo => _fileInfo;


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
            title += (string.IsNullOrWhiteSpace(title) ? "" : " | ") + Branding.SiteName(language);

            description = string.IsNullOrWhiteSpace(description) ? Branding.DESCRIPTION : description.Trim();
            description = WebUtility.HtmlEncode(description);

            var secureThumbUrl = thumbnailUrl.Replace("http://", "https://");
            
            var s = $@"
                    <meta property='og:title' content='{title}' />
                    <meta property='og:image' content='{thumbnailUrl}' />
                    <meta property='og:image:url' content='{thumbnailUrl}' />
                    <meta property='og:image:secure_url' content='{secureThumbUrl}' />
                    <meta property='og:description' content='{description}' />
                    <meta name='title' content='{title}' />
                    <meta name='description' content='{description}' />
                    <title>{title}</title>
            ";

            return _fileHeader + s + _fileFooter;
        }
    }
}
