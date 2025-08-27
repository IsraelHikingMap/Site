using IsraelHiking.Common;
using IsraelHiking.Common.Extensions;
using IsraelHiking.DataAccessInterfaces;
using Microsoft.Extensions.Logging;
using NetTopologySuite.Features;
using NetTopologySuite.Geometries;
using System;
using System.Collections.Concurrent;
using System.Collections.Generic;
using System.Linq;
using System.Text.RegularExpressions;
using System.Threading.Tasks;
using WikiClientLibrary.Client;
using WikiClientLibrary.Generators;
using WikiClientLibrary.Pages;
using WikiClientLibrary.Sites;

namespace IsraelHiking.DataAccess;

public class INatureGateway : IINatureGateway
{
    private const string BASE_API_ADDRESS = "https://inature.info/w/api.php";
    private const int RETRIES = 10;

    private readonly ILogger _logger;
    private WikiSite _wikiSite;

    public INatureGateway(ILogger logger)
    {
        _logger = logger;
    }

    public async Task Initialize()
    {
        var wikiClient = new WikiClient
        {
            ClientUserAgent = Branding.USER_AGENT,
            Timeout = TimeSpan.FromMinutes(1)
        };
        _wikiSite = new WikiSite(wikiClient, new SiteOptions(BASE_API_ADDRESS));
        await _wikiSite.Initialization;
        _logger.LogInformation("Finished initializing iNature service");
    }

    public async Task<List<IFeature>> GetAll()
    {
        var allpagesGenerator = new AllPagesGenerator(_wikiSite)
        {
            PaginationSize = 500
        };
        var results = await allpagesGenerator.EnumItemsAsync().ToListAsync().ConfigureAwait(false);
        _logger.LogInformation($"Got {results.Count} pages from iNature, fetching their content and images");
        var features = await GetFeaturesFromTitles(results.Select(r => r.Title).ToArray());
        return features.ToList();
    }

    private async Task<string> GetPageImageUrl(WikiPage page)
    {
        var match = Regex.Match(page.Content, @"תמונה=(.*)");
        if (!match.Success)
        {
            return null;
        }

        var imagePage = new WikiPage(_wikiSite, "File:" + WikimediaCommonGateway.GetWikiName(match.Groups[1].Value));
        var retry = 0;
        while (retry < RETRIES && imagePage.LastFileRevision == null)
        {
            try
            {
                await imagePage.RefreshAsync(PageQueryOptions.None).ConfigureAwait(false);
                if (imagePage.LastFileRevision == null)
                {
                    break;
                }
            }
            catch
            {
                retry++;
                await Task.Delay(100).ConfigureAwait(false);
            }
        }

        if (retry >= RETRIES)
        {
            _logger.LogWarning("Failed to get image file for page after 10 retries: " + imagePage.Title);
        }

        return imagePage.LastFileRevision?.Url;
    }

    private async Task<WikiPage> GetPageContent(string title)
    {
        WikiPage page = null;
        var retry = 0;
        while (retry < RETRIES && page?.Content == null)
        {
            try
            {
                page = new WikiPage(_wikiSite, title);
                await page.RefreshAsync(PageQueryOptions.FetchContent).ConfigureAwait(false);
            }
            catch (Exception ex)
            {
                retry++;
                await Task.Delay(100).ConfigureAwait(false);
                if (retry == RETRIES)
                {
                    _logger.LogWarning("Failed to get content for page after 10 retries: " + title + " " + ex.ToString());
                }
            }
        }
        return page;
    }

    private async Task<Feature> TitleToFeature(string title)
    {
        var page = await GetPageContent(title).ConfigureAwait(false);
        if (string.IsNullOrEmpty(page?.Content))
        {
            return null;
        }
        if (page.Content.Contains("קטגוריה:לבדיקה"))
        {
            // this page should not be displayed as it is still in editing.
            return null;
        }
        if (!page.Content.Contains("{{נקודת עניין") &&
            !page.Content.Contains("{{שמורת טבע") &&
            !page.Content.Contains("{{גן לאומי") &&
            !page.Content.Contains("{{אתר לאומי") &&
            !page.Content.Contains("{{מסלולי טיול"))
        {
            // non-POI
            return null;
        }

        if (page.Content.Contains("{{מסלולי טיול למפרסמים"))
        {
            // Remove advertised routes
            return null;
        }

        var shareMatch = Regex.Match(page.Content, @"israelhiking\.osm\.org\.il/share/(.*?)[""']", RegexOptions.IgnoreCase);
        if (page.Content.Contains("{{מסלולי טיול") && !shareMatch.Success)
        {
            return null;
        }
        var descriptionMatch = Regex.Match(page.Content, @"סקירה=(.*)");
        if (!descriptionMatch.Success)
        {
            return null;
        }
        var description = descriptionMatch.Groups[1].Value;
        var match = Regex.Match(page.Content, @"נצ=(\d+\.\d+)\s*,\s*(\d+\.\d+)");
        if (!match.Success)
        {
            return null;
        }
        var geoLocation = new LatLng(double.Parse(match.Groups[1].Value), double.Parse(match.Groups[2].Value));
        var feature = new Feature(new Point(geoLocation.ToCoordinate()), new AttributesTable
        {
            {FeatureAttributes.DESCRIPTION, description},
            {FeatureAttributes.DESCRIPTION + ":" + Languages.HEBREW, description},
            {FeatureAttributes.NAME, page.Title},
            {FeatureAttributes.NAME + ":" + Languages.HEBREW, page.Title},
            {FeatureAttributes.ID, page.Id.ToString()},
            {FeatureAttributes.POI_SOURCE, Sources.INATURE},
            {FeatureAttributes.POI_LANGUAGE, Languages.HEBREW},
            {FeatureAttributes.POI_LANGUAGES, new [] {Languages.HEBREW}},
            {FeatureAttributes.POI_SEARCH_FACTOR, 1.0},
            {FeatureAttributes.WEBSITE, _wikiSite.SiteInfo.MakeArticleUrl(page.Title)},
            {FeatureAttributes.POI_SOURCE_IMAGE_URL, "https://user-images.githubusercontent.com/3269297/37312048-2d6e7488-2652-11e8-9dbe-c1465ff2e197.png" }
        });
        feature.SetLastModified(page.LastRevision.TimeStamp);
        feature.SetLocation(geoLocation.ToCoordinate());
        var image = await GetPageImageUrl(page).ConfigureAwait(false);
        if (!string.IsNullOrWhiteSpace(image))
        {
            feature.Attributes.Add(FeatureAttributes.IMAGE_URL, image);
        }
        if (shareMatch.Success)
        {
            feature.Attributes[FeatureAttributes.NAME] += " - טבע ונופים";
            feature.Attributes[FeatureAttributes.NAME + ":" + Languages.HEBREW] += " - טבע ונופים";
            feature.Attributes.Add(FeatureAttributes.POI_CATEGORY, Categories.ROUTE_HIKE);
            feature.Attributes.Add(FeatureAttributes.POI_ICON, "icon-hike");
            feature.Attributes.Add(FeatureAttributes.POI_ICON_COLOR, "black");
            feature.Attributes.Add(FeatureAttributes.POI_SHARE_REFERENCE, shareMatch.Groups[1].Value);
        }
        else
        {
            feature.Attributes.Add(FeatureAttributes.POI_ICON, "icon-inature");
            feature.Attributes.Add(FeatureAttributes.POI_ICON_COLOR, "#116C00");
            feature.Attributes.Add(FeatureAttributes.POI_CATEGORY, Categories.INATURE);
        }
        feature.SetId();
        return feature;
    }

    public async Task<List<IFeature>> GetUpdates(DateTime lastUpdated)
    {
        var recentChangesGenerator = new RecentChangesGenerator(_wikiSite)
        {
            StartTime = DateTime.Now,
            EndTime = lastUpdated,
            LastRevisionsOnly = true,
            TypeFilters = RecentChangesFilterTypes.Create | RecentChangesFilterTypes.Edit
        };
        var titles = await recentChangesGenerator.EnumItemsAsync().ToListAsync().ConfigureAwait(false);
        _logger.LogInformation($"Got {titles.Count} updated pages from iNature, fetching their content and images");
        return await GetFeaturesFromTitles(titles.Select(i => i.Title).ToArray());
    }

    private async Task<List<IFeature>> GetFeaturesFromTitles(string[] titles)
    {
        var features = new ConcurrentBag<IFeature>();
        await Task.Run(() =>
        {
            Parallel.ForEach(titles, new ParallelOptions { MaxDegreeOfParallelism = 5 }, (title) =>
            {
                var feature = TitleToFeature(title).Result;
                if (feature != null)
                {
                    features.Add(feature);
                }
            });
        }).ConfigureAwait(false);
        return features.ToList();
    }
}