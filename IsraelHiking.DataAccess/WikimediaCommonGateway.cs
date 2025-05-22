using IsraelHiking.Common;
using IsraelHiking.Common.Configuration;
using IsraelHiking.DataAccessInterfaces;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using NetTopologySuite.Geometries;
using System;
using System.IO;
using System.Linq;
using System.Text.RegularExpressions;
using System.Threading.Tasks;
using WikiClientLibrary.Client;
using WikiClientLibrary.Files;
using WikiClientLibrary.Pages;
using WikiClientLibrary.Sites;
using ILogger = Microsoft.Extensions.Logging.ILogger;

namespace IsraelHiking.DataAccess;

internal class LoginAgainAccountAssertionFailureHandler : IAccountAssertionFailureHandler
{

    private readonly NonPublicConfigurationData _options;

    public LoginAgainAccountAssertionFailureHandler(NonPublicConfigurationData options)
    {
        _options = options;
    }

    public async Task<bool> Login(WikiSite site)
    {
        await site.LoginAsync(_options.WikiMediaUserName, _options.WikiMediaPassword);
        return true;
    }
}

public class WikimediaCommonGateway : IWikimediaCommonGateway
{
    private const string BASE_API_ADDRESS = "https://commons.wikimedia.org/w/api.php";

    private readonly ILogger _logger;
    private readonly NonPublicConfigurationData _options;
    private WikiSite _site;

    public WikimediaCommonGateway(IOptions<NonPublicConfigurationData> options,
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
            ClientUserAgent = Branding.USER_AGENT,
            Timeout = new TimeSpan(0, 5, 0) // allow large images upload
        };

        _site = new WikiSite(wikiClient, new SiteOptions(BASE_API_ADDRESS));
        await _site.Initialization;
        await _site.LoginAsync(_options.WikiMediaUserName, _options.WikiMediaPassword);
        _site.AccountAssertionFailureHandler = new LoginAgainAccountAssertionFailureHandler(_options);
        _logger.LogInformation("Finished initializing Wikimedia common service");
    }

    public async Task<string> UploadImage(string fileName, string description, string author, Stream contentStream, Coordinate location)
    {
        _logger.LogInformation($"Upload an image to wikimedia common. File name: {fileName}, Location: {location.Y}, {location.X}");
        var wikiFileName = GetNonExistingFilePageName(fileName);
        var comment = CreateWikipediaComment(location, description, author);
        await _site.GetTokenAsync("edit", true);
        var results = await _site.UploadAsync(wikiFileName, new StreamUploadSource(contentStream), comment, true).ConfigureAwait(false);
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
        _logger.LogInformation($"Finished uploading image successfully. FileName: {fileName}, wikipage: {wikiFileName}");
        return wikiFileName;
    }

    private string CreateWikipediaComment(Coordinate location, string description, string author)
    {
        return "=={{int:filedesc}}==" + Environment.NewLine +
               "{{Information" + Environment.NewLine +
               $"|date={DateTime.Now:yyyy-MM-dd}" + Environment.NewLine +
               $"|description={description}" + Environment.NewLine +
               "|source={{own}}" + Environment.NewLine +
               $"|author=[//www.openstreetmap.org/user/{Uri.EscapeDataString(author)} {author}]" + Environment.NewLine +
               "|permission=public domain" + Environment.NewLine +
               "|other versions=" + Environment.NewLine +
               "}}" + Environment.NewLine + Environment.NewLine +
               "=={{int:license-header}}==" + Environment.NewLine +
               "{{PD-self}}" + Environment.NewLine + Environment.NewLine +
               $"{{{{Location|1={location.Y}|2={location.X}}}}}" + Environment.NewLine + Environment.NewLine +
               "[[Category:Mapeak]]";
    }

    public async Task<string> GetImageUrl(string pageName)
    {
        var imagePage = new WikiPage(_site, pageName);
        await imagePage.RefreshAsync(PageQueryOptions.None);
        return Uri.UnescapeDataString(imagePage.LastFileRevision?.Url);
    }

    public static string GetWikiName(string name)
    {
        var invalidCharacterRegularExpression = new Regex(@"[\\#<>\[\]\?|:{}/~\s+]");
        return invalidCharacterRegularExpression.Replace(name, "_");
    }

    private string GetNonExistingFilePageName(string fileName)
    {
        fileName = fileName.Replace(".jpg", ".jpeg");
        var wikiFileName = $"Mapeak_{GetWikiName(fileName)}";
        var wikiNameWithoutExtension = Path.GetFileNameWithoutExtension(wikiFileName);
        var countingFileName = wikiNameWithoutExtension.Substring(0, Math.Min(170, wikiNameWithoutExtension.Length));
        var extension = Path.GetExtension(wikiFileName);
        ParallelLoopResult results;
        var loopIndex = 0;
        var loopRange = 5;
        do
        {
            results = Parallel.For(loopIndex, loopIndex + loopRange, (index, options) =>
            {
                var pageNameToTest = GetWikiPageFileNameFromIndex(index, countingFileName, extension);
                var pageToTest = new WikiPage(_site, pageNameToTest);
                pageToTest.RefreshAsync(PageQueryOptions.None).Wait();
                if (!pageToTest.Exists)
                {
                    options.Break();
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