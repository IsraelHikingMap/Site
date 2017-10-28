using System;
using System.IO;
using System.Linq;
using System.Net.Http;
using System.Text.RegularExpressions;
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
            if (string.IsNullOrWhiteSpace(_options.WikiMediaUserName))
            {
                _logger.LogError("Wikimedia user is empty!");
            }
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

        public async Task<string> UploadImage(string title, string fileName, Stream contentStream, Coordinate location)
        {
            _logger.LogInformation($"Upload an image to wikimedia common. title: {title}, fileName: {fileName}, Location: {location.Y}, {location.X}");
            var wikiFileName = GetNonExistingFilePageName(title, fileName);
            var comment = CreateWikipediaComment(location, string.IsNullOrWhiteSpace(title) ? title : fileName);
            await _site.GetTokenAsync("edit", true);
            var filePage = new FilePage(_site, wikiFileName);
            var results = await filePage.UploadAsync(new StreamUploadSource(contentStream), comment, true);
            if (results.ResultCode != UploadResultCode.Success)
            {
                throw new Exception("Unable to upload the file\n" + string.Join("\n", results.Warnings.Select(kvp => kvp.Key + ": " + kvp.Value)));
            }
            if (results.Warnings.Any(kvp => kvp.Key == "badfilename"))
            {
                var correctWikiFileName = results.Warnings.First(kvp => kvp.Key == "badfilename").Value;
                _logger.LogWarning($"Received bad file name from wikipedia. old: {wikiFileName}, correct: File:{correctWikiFileName}");
                wikiFileName = "File:" + correctWikiFileName;
            }
            _logger.LogInformation($"Finished uploading image succesfully. title: {title}, fileName: {fileName}, wikipage: {wikiFileName}");
            return wikiFileName;
        }

        private string CreateWikipediaComment(Coordinate location, string description)
        {
            return "=={{int:filedesc}}==" + Environment.NewLine +
                   "{{Information" + Environment.NewLine +
                   $"|date={DateTime.Now:yyyy-MM-dd}" + Environment.NewLine +
                   $"|description={description}" + Environment.NewLine +
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
                return jObject.SelectToken("$..url")?.Value<string>();
            }
        }

        private string GetNonExistingFilePageName(string title, string fileName)
        {
            var name = string.IsNullOrWhiteSpace(title) ? fileName : title;
            if (Path.HasExtension(name) == false)
            {
                name += Path.GetExtension(fileName);
            }
            name = name.Replace(".jpg", ".jpeg");
            var invalidCharacterReularExpression = new Regex(@"[\\#<>\[\]|:{}/~\s+]");
            var wikiFileName = "Israel_Hiking_Map_" + invalidCharacterReularExpression.Replace(name, "_");

            var countingFileName = Path.GetFileNameWithoutExtension(wikiFileName);
            var extension = Path.GetExtension(wikiFileName);
            ParallelLoopResult results;
            var loopIndex = 0;
            var loopRange = 5;
            do
            {
                results = Parallel.For(loopIndex, loopIndex + loopRange, (index, options) =>
                {
                    using (var client = new HttpClient())
                    {
                        var pageNameToTest = GetWikiPageFileNameFromIndex(index, countingFileName, extension);
                        var address =
                            $"{BASE_API_ADDRESS}?action=query&titles={pageNameToTest}&prop=imageinfo&iiprop=url&iimetadataversion=latest&format=json";
                        var response = client.GetAsync(address).Result;
                        var contentString = response.Content.ReadAsStringAsync().Result;
                        var jObject = JObject.Parse(contentString);
                        if (jObject.SelectToken("$..pages")["-1"] != null)
                        {
                            options.Break();
                        }
                    }
                });
                loopIndex += loopRange;
            } while (results.LowestBreakIteration.HasValue == false);
            return GetWikiPageFileNameFromIndex(results.LowestBreakIteration.Value, countingFileName, extension);
        }

        private string GetWikiPageFileNameFromIndex(long index, string countingFileName, string extension)
        {
            var fullFileName = index == 0
                ? countingFileName + extension
                : countingFileName + "_" + index + extension;
            return $"File:{fullFileName}";
        }
    }
}
