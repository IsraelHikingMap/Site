using IsraelHiking.Common;
using IsraelHiking.Common.Extensions;
using IsraelHiking.DataAccessInterfaces;
using NetTopologySuite.Features;
using NetTopologySuite.Geometries;
using Newtonsoft.Json;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Net.Http;
using System.Threading.Tasks;

namespace IsraelHiking.DataAccess
{
    internal class JsonNakebItem
    {
        public long id { get; set; }
        public LatLng start { get; set; }
        public string title { get; set; }
        public DateTime last_modified { get; set; }
    }

    internal class JsonNakebItemExtended : JsonNakebItem
    {
        public double length { get; set; }
        public string picture { get; set; }
        public string link { get; set; }
        public string[] attributes { get; set; }
        public string prolog { get; set; }
        public LatLng[] latlngs { get; set; }
        public MarkerData[] markers { get; set; }
    }

    public class NakebGateway : INakebGateway
    {
        private const string NAKEB_BASE_ADDRESS = "https://www.nakeb.co.il/api/hikes";
        private const string NAKEB_LOGO = "https://www.nakeb.co.il/static/images/hikes/logo_1000x667.jpg";
        private readonly IHttpClientFactory _httpClientFactory;

        public NakebGateway(IHttpClientFactory httpClientFactory)
        {
            _httpClientFactory = httpClientFactory;
        }

        public async Task<List<Feature>> GetAll()
        {
            var client = _httpClientFactory.CreateClient();
            var reponse = await client.GetAsync($"{NAKEB_BASE_ADDRESS}/all");
            var content = await reponse.Content.ReadAsStringAsync();
            var nakebItem = JsonConvert.DeserializeObject<List<JsonNakebItem>>(content);
            return nakebItem.Select(ConvertToPointFeature).ToList();
        }

        public async Task<Feature> GetById(string id)
        {
            var client = _httpClientFactory.CreateClient();
            var reponse = await client.GetAsync($"{NAKEB_BASE_ADDRESS}/{id}");
            var content = await reponse.Content.ReadAsStringAsync();
            var nakebItem = JsonConvert.DeserializeObject<JsonNakebItemExtended>(content);
            var attributes = GetAttributes(nakebItem);
            var description = nakebItem.prolog ?? string.Empty;
            if (!description.EndsWith("."))
            {
                description += ".";
            }
            description += $"\n{string.Join(", ", nakebItem.attributes)}.";
            attributes.Add(FeatureAttributes.DESCRIPTION + ":" + Languages.HEBREW, description);
            attributes.Add(FeatureAttributes.IMAGE_URL, nakebItem.picture);
            attributes.Add(FeatureAttributes.WEBSITE, nakebItem.link);
            attributes.Add(FeatureAttributes.POI_SOURCE_IMAGE_URL, NAKEB_LOGO);
            var lineString = new LineString(nakebItem.latlngs.Select(l => l.ToCoordinate()).ToArray());
            // Ignoring markers for simplification
            var feature = new Feature(lineString, attributes);
            feature.SetTitles();
            feature.SetId();
            return feature;
        }

        private Feature ConvertToPointFeature(JsonNakebItem nakebItem)
        {
            var point = new Point(nakebItem.start.ToCoordinate());
            return new Feature(point, GetAttributes(nakebItem));
        }

        private AttributesTable GetAttributes(JsonNakebItem nakebItem)
        {
            var geoLocation = new AttributesTable
            {
                {FeatureAttributes.LAT, nakebItem.start.Lat},
                {FeatureAttributes.LON, nakebItem.start.Lng}
            };
            var attributes = new AttributesTable
            {
                {FeatureAttributes.ID, nakebItem.id.ToString()},
                {FeatureAttributes.NAME, nakebItem.title},
                {FeatureAttributes.NAME + ":" + Languages.HEBREW, nakebItem.title},
                {FeatureAttributes.POI_SOURCE, Sources.NAKEB},
                {FeatureAttributes.POI_CATEGORY, Categories.ROUTE_HIKE},
                {FeatureAttributes.POI_LANGUAGE, Languages.HEBREW},
                {FeatureAttributes.POI_ICON, "icon-hike"},
                {FeatureAttributes.POI_ICON_COLOR, "black"},
                {FeatureAttributes.POI_SEARCH_FACTOR, 1.0},
                {FeatureAttributes.POI_GEOLOCATION, geoLocation},
                {FeatureAttributes.POI_LAST_MODIFIED, nakebItem.last_modified.ToString("o")}
            };

            return attributes;
        }
    }
}