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

namespace IsraelHiking.DataAccess
{
    public class INatureGateway : IINatureGateway
    {
        private const string BASE_API_ADDRESS = "https://inature.info/w/api.php";

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
                ClientUserAgent = "IsraelHikingMapSite/5.x",
                Timeout = TimeSpan.FromMinutes(1)
            };
            _wikiSite = new WikiSite(wikiClient, new SiteOptions(BASE_API_ADDRESS));
            await _wikiSite.Initialization;
        }

        public async Task<List<Feature>> GetAll()
        {
            var allpagesGenerator = new AllPagesGenerator(_wikiSite)
            {
                PaginationSize = 500
            };
            var results = await allpagesGenerator.EnumItemsAsync().ToListAsync().ConfigureAwait(false);
            _logger.LogInformation($"Got {results.Count} pages from iNature, fetching their content and images");
            var features = new ConcurrentBag<Feature>();
            await Task.Run(() =>
            {
                Parallel.ForEach(results, new ParallelOptions { MaxDegreeOfParallelism = 5 }, (page) =>
               {
                   var feature = PageToFeature(page).Result;
                   if (feature != null)
                   {
                       features.Add(feature);
                   }
               });
            }).ConfigureAwait(false);
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
            while (retry < 10 && imagePage.LastFileRevision == null)
            {
                try
                {
                    await imagePage.RefreshAsync(PageQueryOptions.None).ConfigureAwait(false);
                }
                catch
                {
                    retry++;
                    await Task.Delay(100).ConfigureAwait(false);
                }
            }

            if (retry >= 10)
            {
                _logger.LogWarning("Failed to get image file for page after 10 retries: " + imagePage.Title);
            }

            return imagePage.LastFileRevision?.Url;
        }

        private async Task<WikiPage> GetPageContent(WikiPageStub pageStub)
        {
            WikiPage page = null;
            var retry = 0;
            while (retry < 10 && page?.Content == null)
            {
                try
                {
                    page = new WikiPage(_wikiSite, pageStub.Id);
                    await page.RefreshAsync(PageQueryOptions.FetchContent).ConfigureAwait(false);
                }
                catch
                {
                    retry++;
                    await Task.Delay(100).ConfigureAwait(false);
                }
            }

            if (retry >= 10)
            {
                _logger.LogWarning("Failed to get content for page after 10 retries: " + pageStub.Title);
            }
            return page;
        }

        public async Task<Feature> GetById(string id)
        {
            var wikiPageStub = new WikiPageStub(int.Parse(id));
            var feature = await PageToFeature(wikiPageStub);
            return feature;
        }

        private async Task<Feature> PageToFeature(WikiPageStub pageStub)
        {
            var page = await GetPageContent(pageStub).ConfigureAwait(false);
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
            var geoLocationTable = new AttributesTable
                {
                    {FeatureAttributes.LAT, geoLocation.Lat},
                    {FeatureAttributes.LON, geoLocation.Lng}
                };
            var feature = new Feature(new Point(geoLocation.ToCoordinate()), new AttributesTable
                {
                    {FeatureAttributes.POI_GEOLOCATION, geoLocationTable},
                    {FeatureAttributes.DESCRIPTION + ":" + Languages.HEBREW, description},
                    {FeatureAttributes.NAME, page.Title},
                    {FeatureAttributes.NAME + ":" + Languages.HEBREW, page.Title},
                    {FeatureAttributes.ID, page.Id.ToString()},
                    {FeatureAttributes.POI_SOURCE, Sources.INATURE},
                    {FeatureAttributes.POI_LANGUAGE, Languages.HEBREW},
                    {FeatureAttributes.POI_SEARCH_FACTOR, 1.0},
                    {FeatureAttributes.WEBSITE, _wikiSite.SiteInfo.MakeArticleUrl(page.Title)},
                    {FeatureAttributes.POI_SOURCE_IMAGE_URL, "https://user-images.githubusercontent.com/3269297/37312048-2d6e7488-2652-11e8-9dbe-c1465ff2e197.png" },
                    {FeatureAttributes.POI_LAST_MODIFIED, page.LastRevision.TimeStamp.ToString("o")},
                });
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
            feature.SetTitles();
            feature.SetId();
            return feature;
        }
    }
}
