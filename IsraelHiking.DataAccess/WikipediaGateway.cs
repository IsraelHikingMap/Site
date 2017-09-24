using System;
using System.IO;
using System.Linq;
using System.Net.Http;
using System.Threading.Tasks;
using GeoAPI.Geometries;
using IsraelHiking.Common;
using IsraelHiking.DataAccessInterfaces;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using Newtonsoft.Json.Linq;
using WikiClientLibrary.Client;
using WikiClientLibrary.Pages;
using WikiClientLibrary.Sites;
using ILogger = Microsoft.Extensions.Logging.ILogger;

namespace IsraelHiking.DataAccess
{
    public class WikipediaGateway : IWikipediaGateway
    {
        private const string BASE_API_ADDRESS = "https://commons.wikimedia.org/w/api.php";

        private readonly ILogger _logger;
        private readonly NonPublicConfigurationData _options;
        private WikiSite _site;

        public WikipediaGateway(IOptions<NonPublicConfigurationData> options,
            ILogger logger)
        {
            _logger = logger;
            _options = options.Value;
        }

        public async Task Initialize()
        {
            var wikiClient = new WikiClient
            {
                ClientUserAgent = "IsraelHikingMapSite/5.0",
                Timeout = new TimeSpan(0, 5, 0) // allow large images upload
            };
            _site = await WikiSite.CreateAsync(wikiClient, new SiteOptions(BASE_API_ADDRESS));
            await _site.LoginAsync(_options.WikiMediaUserName, _options.WikiMediaPassword);
        }

        public async Task<string> UploadImage(string imageName, Stream contentStream, Coordinate location)
        {
            _logger.LogInformation($"Upload an image to wikimedia common: {imageName}, Location: {location.Y}, {location.X}");
            var wikiFileName = "File:Israel_Hiking_Map_" + imageName.Replace(" ", "_");
            var comment = CreateWikipediaComment(location, imageName);
            await _site.GetTokenAsync("edit", true);
            var results = await FilePage.UploadAsync(_site, contentStream, wikiFileName, comment, true);
            if (results.ResultCode != UploadResultCode.Success)
            {
                throw new Exception("Unable to upload the file\n" + string.Join("\n", results.Warnings.Select(kvp => kvp.Key + ": " + kvp.Value)));
            }
            if (results.Warnings.Any(kvp => kvp.Key == "badfilename"))
            {
                wikiFileName = "File:" + results.Warnings.First(kvp => kvp.Key == "badfilename").Value;
            }
            _logger.LogInformation($"Finished uploading image {imageName}");
            return wikiFileName;
        }

        private string CreateWikipediaComment(Coordinate location, string imageName)
        {
            return "=={{int:filedesc}}==" + Environment.NewLine +
                   "{{Information" + Environment.NewLine +
                   $"|date={DateTime.Now:yyyy-MM-dd}" + Environment.NewLine +
                   $"|description={imageName}" + Environment.NewLine +
                   "|source={{own}}" + Environment.NewLine +
                   "|author=[[User:IsraelHikingMap|IsraelHikingMap]]" + Environment.NewLine +
                   "|permission=" + Environment.NewLine +
                   "|other versions=" + Environment.NewLine +
                   "}}" + Environment.NewLine + Environment.NewLine +
                   "=={{int:license-header}}==" + Environment.NewLine +
                   "{{self|cc-by-sa-4.0}}" + Environment.NewLine + Environment.NewLine +
                   $"{{{{Location|1={location.Y}|2={location.X}}}}}" + Environment.NewLine + Environment.NewLine +
                   "[[Category:Israel Hiking Map]]";
        }

        public async Task<string> GetImageUrl(string pageName)
        {
            using (var client = new HttpClient())
            {
                var address = $"{BASE_API_ADDRESS}?action=query&titles={pageName}&prop=imageinfo&iiprop=url&iimetadataversion=latest&format=json";
                var response = await client.GetAsync(address);
                var contentString = await response.Content.ReadAsStringAsync();
                var jObject = JObject.Parse(contentString);
                return jObject.Descendants().FirstOrDefault(d => d.SelectToken("url") != null)?.Value<string>("url");
            }
        }

    }
}
