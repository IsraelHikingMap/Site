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

        public async Task<FeatureCollection> GetById(int id)
        {
            using (var client = new HttpClient())
            {
                var reponse = await client.GetAsync($"{NAKEB_BASE_ADDRESS}/{id}");
                var content = await reponse.Content.ReadAsStringAsync();
                var nakebItem = JsonConvert.DeserializeObject<JsonNakebItemExtended>(content);
                var attributes = GetAttributes(nakebItem);
                var description = nakebItem.prolog ?? string.Empty;
                description += $"\n{string.Join(",", nakebItem.attributes)}\nאורך: {nakebItem.length} ק\"מ";
                attributes.AddAttribute(FeatureAttributes.DESCRIPTION, description);
                attributes.AddAttribute(FeatureAttributes.IMAGE_URL, nakebItem.picture);
                attributes.AddAttribute(FeatureAttributes.WEBSITE, nakebItem.link);
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
            var attributes = new AttributesTable();
            attributes.AddAttribute(FeatureAttributes.ID, nakebItem.id);
            attributes.AddAttribute(FeatureAttributes.NAME, nakebItem.title);
            attributes.AddAttribute(FeatureAttributes.POI_SOURCE, Sources.NAKEB);
            var geoLocation = new AttributesTable();
            geoLocation.AddAttribute(FeatureAttributes.LAT, nakebItem.start.lat);
            geoLocation.AddAttribute(FeatureAttributes.LON, nakebItem.start.lng);
            attributes.AddAttribute(FeatureAttributes.GEOLOCATION, geoLocation);
            attributes.AddAttribute(FeatureAttributes.POI_CATEGORY, Categories.ROUTE_HIKE);
            attributes.AddAttribute(FeatureAttributes.ICON, "icon-nakeb");
            attributes.AddAttribute(FeatureAttributes.ICON_COLOR, "black");
            attributes.AddAttribute(FeatureAttributes.SEARCH_FACTOR, 1);
            return attributes;
        }

        private IFeature ConvertToPointFeature(MarkerData markerData)
        {
            var point = new Point(new Coordinate().FromLatLng(markerData.latlng));
            var attributes = new AttributesTable();
            attributes.AddAttribute(FeatureAttributes.NAME, markerData.title);
            return new Feature(point, attributes);
        }
    }
}