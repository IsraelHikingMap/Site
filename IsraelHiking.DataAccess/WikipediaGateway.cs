using GeoAPI.Geometries;
using IsraelHiking.Common;
using IsraelHiking.Common.Extensions;
using IsraelHiking.Common.Poi;
using IsraelHiking.DataAccessInterfaces;
using Microsoft.Extensions.Logging;
using NetTopologySuite.Features;
using NetTopologySuite.Geometries;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using WikiClientLibrary;
using WikiClientLibrary.Client;
using WikiClientLibrary.Generators;
using WikiClientLibrary.Pages;
using WikiClientLibrary.Pages.Queries;
using WikiClientLibrary.Pages.Queries.Properties;
using WikiClientLibrary.Sites;

namespace IsraelHiking.DataAccess
{
    public class WikipediaGateway : IWikipediaGateway
    {
        private const string WIKI_LOGO = "https://upload.wikimedia.org/wikipedia/en/thumb/8/80/Wikipedia-logo-v2.svg/128px-Wikipedia-logo-v2.svg.png";
        private readonly ILogger _logger;
        private readonly Dictionary<string, WikiSite> _wikiSites;
        public WikipediaGateway(ILogger logger)
        {
            _logger = logger;
            _wikiSites = new Dictionary<string, WikiSite>();
        }

        public async Task Initialize()
        {
            var wikiClient = new WikiClient
            {
                ClientUserAgent = "IsraelHikingMapSite/5.x",
                Timeout = new TimeSpan(0, 1, 0)
            };
            foreach (var language in Languages.Array)
            {
                _wikiSites[language] = new WikiSite(wikiClient, new SiteOptions($"https://{language}.wikipedia.org/w/api.php"));
                await _wikiSites[language].Initialization;
            }
        }

        public Task<List<Feature>> GetAll()
        {
            throw new NotImplementedException("Please use GetByLocation instead");
        }

        public Task<Feature> GetByPageTitle(string title, string language)
        {
            var site = _wikiSites[language];
            var page = new WikiPage(site, title);
            return ConvertPageToFeature(page, language);
        }

        /// <summary>
        /// This recursive method is used to get wikipedia features by bounding box.
        /// Since boundingbox can't scroll diue to a wikimedia implementiaion issue the workaround is
        /// to recursivly split each bounding box to 4 rectangles until there's no overflow of results.
        /// A rectangle that is not overflowing will not be split.
        /// See here: https://github.com/CXuesong/WikiClientLibrary/issues/64
        /// </summary>
        /// <param name="southWest">Bottom left corner of the rectangle</param>
        /// <param name="northEast">Top right corner of the rectangle</param>
        /// <param name="language">The relevant language</param>
        /// <returns>A list of features inside this rectangle</returns>
        public async Task<List<Feature>> GetByBoundingBox(Coordinate southWest, Coordinate northEast, string language)
        {
            for (int retryIndex = 0; retryIndex < 3; retryIndex++)
            {
                try
                {
                    var geoSearchGenerator = new GeoSearchGenerator(_wikiSites[language])
                    {
                        BoundingRectangle = GeoCoordinateRectangle.FromBoundingCoordinates(southWest.X, southWest.Y, northEast.X, northEast.Y),
                        PaginationSize = 500
                    };
                    var results = await geoSearchGenerator.EnumItemsAsync().ToListAsync();
                    var features = new List<Feature>();
                    if (results.Count < 500) // recursive stop condition
                    {
                        foreach (var geoSearchResultItem in results)
                        {
                            var coordinate = new Coordinate(geoSearchResultItem.Coordinate.Longitude, geoSearchResultItem.Coordinate.Latitude, double.NaN);
                            var attributes = GetAttributes(coordinate, geoSearchResultItem.Page.Title,
                                geoSearchResultItem.Page.Id.ToString(), language);
                            features.Add(new Feature(new Point(coordinate), attributes));
                        }
                        return features;
                    }
                    var mid = new Coordinate((northEast.X + southWest.X) / 2.0, (northEast.Y - southWest.Y) / 2.0);
                    features.AddRange(await GetByBoundingBox(southWest, mid, language));
                    features.AddRange(await GetByBoundingBox(new Coordinate(mid.X, southWest.Y), new Coordinate(northEast.X, mid.Y), language));
                    features.AddRange(await GetByBoundingBox(new Coordinate(southWest.X, mid.Y), new Coordinate(mid.X, northEast.Y), language));
                    features.AddRange(await GetByBoundingBox(mid, northEast, language));
                    return features;
                }
                catch
                {
                    // this is used since this function throws an unrelated timeout error...
                }
            }
            _logger.LogError($"All Retries failed while trying to get data from {language}.wikipedia");
            return new List<Feature>();
        }

        public Reference GetReference(string title, string language)
        {
            return new Reference
            {
                Url = _wikiSites[language].SiteInfo.MakeArticleUrl(title),
                SourceImageUrl = WIKI_LOGO
            };
        }

        public async Task<Feature> GetById(string id)
        {
            var splitId = id.Split('_');
            var language = splitId.First();
            var pageId = splitId.Last();
            var site = _wikiSites[language];
            var stub = await WikiPageStub.FromPageIds(site, new[] { int.Parse(pageId) }).FirstAsync();
            var page = new WikiPage(site, stub.Title);
            return await ConvertPageToFeature(page, language);
        }

        private async Task<Feature> ConvertPageToFeature(WikiPage page, string language)
        {
            await page.RefreshAsync(new WikiPageQueryProvider
            {
                Properties =
                {
                    new ExtractsPropertyProvider {AsPlainText = true, IntroductionOnly = true, MaxSentences = 1},
                    new PageImagesPropertyProvider {QueryOriginalImage = true},
                    new GeoCoordinatesPropertyProvider {QueryPrimaryCoordinate = true},
                    new RevisionsPropertyProvider { FetchContent = false }
                }
            });
            if (page.Exists == false)
            {
                return null;
            }
            var geoCoordinate = page.GetPropertyGroup<GeoCoordinatesPropertyGroup>().PrimaryCoordinate;
            if (geoCoordinate.IsEmpty)
            {
                return null;
            }
            var coordinate = new Coordinate(geoCoordinate.Longitude, geoCoordinate.Latitude, double.NaN);
            var attributes = GetAttributes(coordinate, page.Title, page.Id.ToString(), language);
            attributes.Add(FeatureAttributes.DESCRIPTION + ":" + language, page.GetPropertyGroup<ExtractsPropertyGroup>().Extract ?? string.Empty);
            var imageUrl = page.GetPropertyGroup<PageImagesPropertyGroup>().OriginalImage.Url ?? string.Empty;
            if (!string.IsNullOrWhiteSpace(imageUrl) &&
                (imageUrl.EndsWith(".jpg", StringComparison.OrdinalIgnoreCase) ||
                imageUrl.EndsWith(".jpeg", StringComparison.OrdinalIgnoreCase) ||
                imageUrl.EndsWith(".png", StringComparison.OrdinalIgnoreCase) ||
                imageUrl.EndsWith(".bmp", StringComparison.OrdinalIgnoreCase)))
            {
                attributes.Add(FeatureAttributes.IMAGE_URL, imageUrl);
            }
            attributes.Add(FeatureAttributes.POI_USER_NAME + ":" + language, page.LastRevision.UserName);
            attributes.Add(FeatureAttributes.POI_USER_ADDRESS + ":" + language, _wikiSites[language].SiteInfo.MakeArticleUrl($"User:{Uri.EscapeUriString(page.LastRevision.UserName)}"));
            attributes.Add(FeatureAttributes.POI_LAST_MODIFIED + ":" + language, page.LastRevision.TimeStamp.ToString("o"));
            var feature = new Feature(new Point(coordinate), attributes);
            feature.SetTitles();
            feature.SetId();
            return feature;
        }

        private AttributesTable GetAttributes(Coordinate location, string title, string id, string language)
        {
            var geoLocation = new AttributesTable
            {
                {FeatureAttributes.LAT, location.Y},
                {FeatureAttributes.LON, location.X}
            };
            var attributes = new AttributesTable
            {
                {FeatureAttributes.ID, language + "_" + id},
                {FeatureAttributes.NAME, title},
                {FeatureAttributes.NAME + ":" + language, title},
                {FeatureAttributes.WIKIPEDIA + ":" + language, title},
                {FeatureAttributes.WIKIPEDIA, language + ":" + title},
                {FeatureAttributes.POI_SOURCE, Sources.WIKIPEDIA},
                {FeatureAttributes.POI_CATEGORY, Categories.WIKIPEDIA},
                {FeatureAttributes.POI_LANGUAGE, language},
                {FeatureAttributes.POI_ICON, "icon-wikipedia-w"},
                {FeatureAttributes.POI_ICON_COLOR, "black"},
                {FeatureAttributes.POI_SEARCH_FACTOR, 1.0},
                {FeatureAttributes.POI_GEOLOCATION, geoLocation},
                {FeatureAttributes.WEBSITE, _wikiSites[language].SiteInfo.MakeArticleUrl(title)},
                {FeatureAttributes.POI_SOURCE_IMAGE_URL, WIKI_LOGO}

            };
            return attributes;
        }
    }
}
