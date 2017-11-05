using System.Collections.Generic;
using System.Collections.ObjectModel;
using System.Linq;
using System.Net.Http;
using System.Threading.Tasks;
using GeoAPI.Geometries;
using IsraelHiking.Common;
using IsraelHiking.DataAccessInterfaces;
using NetTopologySuite.Features;
using NetTopologySuite.Geometries;
using Newtonsoft.Json;

namespace IsraelHiking.DataAccess
{
    internal class JsonNakebItem
    {
        public long id { get; set; }
        public LatLng start { get; set; }
        public string title { get; set; }
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

        public async Task<List<Feature>> GetAll()
        {
            using (var client = new HttpClient())
            {
                var reponse = await client.GetAsync($"{NAKEB_BASE_ADDRESS}/all");
                var content = await reponse.Content.ReadAsStringAsync();
                var nakebItem = JsonConvert.DeserializeObject<List<JsonNakebItem>>(content);
                return nakebItem.Select(ConvertToPointFeature).ToList();
            }
        }

        public async Task<FeatureCollection> GetById(string id)
        {
            using (var client = new HttpClient())
            {
                var reponse = await client.GetAsync($"{NAKEB_BASE_ADDRESS}/{id}");
                var content = await reponse.Content.ReadAsStringAsync();
                var nakebItem = JsonConvert.DeserializeObject<JsonNakebItemExtended>(content);
                var attributes = GetAttributes(nakebItem);
                var description = nakebItem.prolog ?? string.Empty;
                description += $"\n{string.Join(", ", nakebItem.attributes)}\nאורך: {nakebItem.length} ק\"מ";
                attributes.Add(FeatureAttributes.DESCRIPTION, description);
                attributes.Add(FeatureAttributes.IMAGE_URL, nakebItem.picture);
                attributes.Add(FeatureAttributes.WEBSITE, nakebItem.link);
                attributes.Add(FeatureAttributes.SOURCE_IMAGE_URL, "https://www.nakeb.co.il/static/images/hikes/logo_1000x667.jpg");
                var lineString =
                    new LineString(nakebItem.latlngs.Select(l => new Coordinate().FromLatLng(l)).ToArray());
                var features = new List<IFeature> {new Feature(lineString, attributes)};
                features.AddRange(nakebItem.markers.Select(ConvertToPointFeature).ToList());
                return new FeatureCollection(new Collection<IFeature>(features));
            }
        }

        private Feature ConvertToPointFeature(JsonNakebItem nakebItem)
        {
            var point = new Point(new Coordinate().FromLatLng(nakebItem.start));
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
                {FeatureAttributes.ID, nakebItem.id},
                {FeatureAttributes.NAME, nakebItem.title},
                {FeatureAttributes.POI_SOURCE, Sources.NAKEB},
                {FeatureAttributes.POI_CATEGORY, Categories.ROUTE_HIKE},
                {FeatureAttributes.POI_LANGUAGE, Languages.ALL},
                {FeatureAttributes.POI_TYPE, string.Empty},
                {FeatureAttributes.ICON, "icon-hike"},
                {FeatureAttributes.ICON_COLOR, "black"},
                {FeatureAttributes.SEARCH_FACTOR, 1},
                {FeatureAttributes.GEOLOCATION, geoLocation},
            };


            return attributes;
        }

        private IFeature ConvertToPointFeature(MarkerData markerData)
        {
            var point = new Point(new Coordinate().FromLatLng(markerData.Latlng));
            var attributes = new AttributesTable {{FeatureAttributes.NAME, markerData.Title}};
            return new Feature(point, attributes);
        }
    }
}