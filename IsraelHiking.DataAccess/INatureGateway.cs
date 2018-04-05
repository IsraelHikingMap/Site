using System;
using System.Collections.Generic;
using System.Linq;
using System.Text.RegularExpressions;
using System.Threading.Tasks;
using GeoAPI.Geometries;
using IsraelHiking.Common;
using IsraelHiking.DataAccessInterfaces;
using Microsoft.Extensions.Logging;
using NetTopologySuite.Features;
using NetTopologySuite.Geometries;
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
            var results = await allpagesGenerator.EnumItemsAsync().ToList().ConfigureAwait(false);
            _logger.LogInformation($"Got {results.Count} pages from iNature, fetching their content and images");
            var list = results.AsParallel().WithDegreeOfParallelism(5).Select(async (pageStub, i) => {
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
                    !page.Content.Contains("{{אתר לאומי"))
                {
                    // non-POI
                    return null;
                }
                var descriptionLine = page.Content.Split('\n').FirstOrDefault(l => l.StartsWith("<meta name=\"description\""));
                if (descriptionLine == null)
                {
                    return null;
                }
                var description = descriptionLine.Replace("<meta name=\"description\" content=\"", string.Empty)
                    .Replace("\"></meta>", string.Empty);
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
                return new Feature(new Point(new Coordinate().FromLatLng(geoLocation)), new AttributesTable
                {
                    {FeatureAttributes.GEOLOCATION, geoLocationTable},
                    {FeatureAttributes.DESCRIPTION, description},
                    {FeatureAttributes.NAME, page.Title},
                    {FeatureAttributes.ID, page.Id},
                    {FeatureAttributes.IMAGE_URL, await GetPageImageUrl(page).ConfigureAwait(false)},
                    {FeatureAttributes.POI_SOURCE, Sources.INATURE},
                    {FeatureAttributes.POI_LANGUAGE, Languages.HEBREW},
                    {FeatureAttributes.POI_CATEGORY, Categories.INATURE},
                    {FeatureAttributes.POI_NAMES, new AttributesTable {{Languages.HEBREW, page.Title}}},
                    {FeatureAttributes.ICON, "icon-inature"},
                    {FeatureAttributes.ICON_COLOR, "#116C00"},
                    {FeatureAttributes.SEARCH_FACTOR, 1},
                    {FeatureAttributes.WEBSITE, _wikiSite.SiteInfo.MakeArticleUrl(page.Title)},
                    {FeatureAttributes.SOURCE_IMAGE_URL, "https://user-images.githubusercontent.com/3269297/37312048-2d6e7488-2652-11e8-9dbe-c1465ff2e197.png" }
                });
            });
            var features = await Task.WhenAll(list).ConfigureAwait(false);
            return features.Where(f => f != null).ToList();
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
                _logger.LogDebug("Failed to get image file for page after 10 retries: " + imagePage.Title);
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
                    page = new WikiPage(_wikiSite, pageStub.Title);
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
                _logger.LogDebug("Failed to get content for page after 10 retries: " + pageStub.Title);
            }
            return page;
        }

        public Task<FeatureCollection> GetById(string id)
        {
            throw new NotImplementedException("You should not use this function but rather use the data from the repository");
        }
    }
}
