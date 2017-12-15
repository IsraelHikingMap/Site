using System;
using System.Collections.Generic;
using System.Collections.ObjectModel;
using System.Linq;
using System.Net;
using System.Net.Http;
using System.Threading.Tasks;
using GeoAPI.Geometries;
using IsraelHiking.Common;
using IsraelHiking.DataAccessInterfaces;
using Microsoft.Extensions.Logging;
using NetTopologySuite.Features;
using NetTopologySuite.Geometries;
using Newtonsoft.Json;

namespace IsraelHiking.DataAccess
{
    class JsonGeoSearchWikiPage : JsonCoordiantes
    {
        public long pageid { get; set; }
        public string title { get; set; }
    }

    class JsonGeoSearchWikiQuery
    {
        public JsonGeoSearchWikiPage[] geosearch { get; set; }
    }

    class JsonGeoSearchWikiResponse
    {
        public JsonGeoSearchWikiQuery query { get; set; }
    }

    class JsonCoordiantes
    {
        public double lat { get; set; }
        public double lon { get; set; }
    }

    class JsonThumbnail
    {
        public double height { get; set; }
        public double width { get; set; }
        public string source { get; set; }
        public string original { get; set; }
    }

    class JsonWikiPage
    {
        public JsonCoordiantes[] coordinates { get; set; }
        public JsonThumbnail thumbnail { get; set; }
        public long pageid { get; set; }
        public string title { get; set; }
        public string extract { get; set; }
        public string pageimage { get; set; }
    }

    class JsonWikiQuery
    {
        public Dictionary<long, JsonWikiPage> pages { get; set; }
    }

    class JsonWikiResponse
    {
        public JsonWikiQuery query { get; set; }
    }


    public class WikipediaGateway : IWikipediaGateway
    {
        private readonly ILogger _logger;

        public WikipediaGateway(ILogger logger)
        {
            _logger = logger;
        }

        public Task<List<Feature>> GetAll()
        {
            // HM TODO: read from cached file here intead?
            throw new NotImplementedException("Please use GetByLocation instead");
        }

        public async Task<List<Feature>> GetByLocation(Coordinate center, string language)
        {
            var centerString = $"{center.Y}|{center.X}";
            var address = $"https://{language}.wikipedia.org/w/api.php?format=json&action=query&list=geosearch&gsradius=10000&gscoord={centerString}&gslimit=500";
            for (int retryIndex = 0; retryIndex < 3; retryIndex++)
            {
                try
                {
                    using (var client = new HttpClient())
                    {
                        var response = await client.GetAsync(address);
                        if (!response.IsSuccessStatusCode)
                        {
                            return new List<Feature>();
                        }
                        var jsonString = await response.Content.ReadAsStringAsync();
                        var jsonResponse = JsonConvert.DeserializeObject<JsonGeoSearchWikiResponse>(jsonString);
                        var features = new List<Feature>();
                        foreach (var geoSearchWikiPage in jsonResponse.query.geosearch)
                        {
                            var coordinate = new Coordinate(geoSearchWikiPage.lon, geoSearchWikiPage.lat);
                            var attributes = GetAttributes(coordinate, geoSearchWikiPage.title,
                                $"{language}_{geoSearchWikiPage.pageid}", language);
                            features.Add(new Feature(new Point(coordinate), attributes));
                        }
                        return features;
                    }
                }
                catch 
                {
                    // this is used since this function throws an unrelated timeout error...
                }
            }
            _logger.LogError($"All Retries failed while trying to get data from {address}\n");
            return new List<Feature>();
        }

        public async Task<FeatureCollection> GetById(string id)
        {
            var language = id.Split('_').First();
            var pageId = id.Split('_').Last();
            using (var client = new HttpClient())
            {
                var baseAddress = $"https://{language}.wikipedia.org/";
                var address = $"{baseAddress}w/api.php?format=json&action=query&pageids={pageId}&prop=extracts|pageimages|coordinates&explaintext=true&exintro=true&exsentences=1";
                var response = await client.GetAsync(address);
                var stringContent = await response.Content.ReadAsStringAsync();
                var responseObject = JsonConvert.DeserializeObject<JsonWikiResponse>(stringContent);
                var page = responseObject.query.pages.Values.First();
                var jsonGeoLocation = page.coordinates.First();
                var coordinate = new Coordinate(jsonGeoLocation.lon, jsonGeoLocation.lat);
                var attributes = GetAttributes(coordinate, page.title, id, language);
                attributes.Add(FeatureAttributes.DESCRIPTION, page.extract ?? string.Empty);
                attributes.Add(FeatureAttributes.IMAGE_URL, GetOriginalImageUrl(page));
                attributes.Add(FeatureAttributes.WEBSITE, $"{baseAddress}?curid={page.pageid}");

                return new FeatureCollection(new Collection<IFeature> { new Feature(new Point(coordinate), attributes)});
            }
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
                {FeatureAttributes.ID, id},
                {FeatureAttributes.NAME, title},
                {FeatureAttributes.POI_SOURCE, Sources.WIKIPEDIA},
                {FeatureAttributes.POI_CATEGORY, Categories.WIKIPEDIA},
                {FeatureAttributes.POI_LANGUAGE, language},
                {FeatureAttributes.OSM_TYPE, string.Empty},
                {FeatureAttributes.ICON, "icon-wikipedia-w"},
                {FeatureAttributes.ICON_COLOR, "black"},
                {FeatureAttributes.SEARCH_FACTOR, 1},
                {FeatureAttributes.GEOLOCATION, geoLocation},
                {FeatureAttributes.SOURCE_IMAGE_URL, "https://upload.wikimedia.org/wikipedia/en/thumb/8/80/Wikipedia-logo-v2.svg/128px-Wikipedia-logo-v2.svg.png" }
            };
            return attributes;
        }

        /// <summary>
        /// This utility method is used to convert a thumbnail image to the original full size image from wikipedia
        /// </summary>
        /// <param name="page">The page containing the data</param>
        /// <returns></returns>
        private string GetOriginalImageUrl(JsonWikiPage page)
        {
            if (string.IsNullOrWhiteSpace(page.pageimage) || string.IsNullOrWhiteSpace(page.thumbnail?.source))
            {
                return page.thumbnail?.source ?? string.Empty;
            }
            var imageUrl = WebUtility.UrlDecode(page.thumbnail.source);
            var indexOfpageImage = imageUrl.IndexOf(page.pageimage, StringComparison.Ordinal);
            if (indexOfpageImage == -1)
            {
                return imageUrl;
            }
            imageUrl = imageUrl.Substring(0, indexOfpageImage + page.pageimage.Length);
            imageUrl = imageUrl.Replace("/thumb/", "/");
            return imageUrl;
        }
    }
}
