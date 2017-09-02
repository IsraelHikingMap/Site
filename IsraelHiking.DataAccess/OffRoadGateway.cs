using System;
using System.Collections.Generic;
using System.Collections.ObjectModel;
using System.Linq;
using System.Net.Http;
using System.Threading.Tasks;
using GeoAPI.Geometries;
using IsraelHiking.Common;
using Nest;
using NetTopologySuite.Features;
using NetTopologySuite.Geometries;
using Newtonsoft.Json;

namespace IsraelHiking.DataAccess
{
    internal class OffroadJsonRequest
    {
        public bool offRoading { get; set; }
        public bool walking { get; set; }
        public bool cycling { get; set; }
    }

    internal class JsonOffRoadResponse
    {
        public JsonOffroadItem[] items { get; set; }
    }

    internal class JsonOffroadItem
    {
        public JsonOffroadTrack track { get; set; }
    }

    internal class JsonLatLang
    {
        public double latitude { get; set; }
        public double longitude { get; set; }
    }

    internal class JsonOffroadTrack
    {
        public JsonLatLang start { get; set; }
        public JsonLatLang end { get; set; }
        public string title { get; set; }
        public string id { get; set; }
        public string activityType { get; set; }
        public string userId { get; set; }
        //public string trackIconResourceName { get; set; }
        public string myAdventureUserId { get; set; }
    }

    internal class JsonOffroadTrackExtended : JsonOffroadTrack
    {
        public string shortDescription { get; set; }
        public string trackLayerKey { get; set; }
    }

    internal class JsonOffroadTrackLyers
    {
        public JsonOffroadLayer[] layers { get; set; }
    }

    internal class JsonOffroadLayer
    {
        public JsonLatLang[] path { get; set; }
    }

    public class OffRoadGateway : IOffRoadGateway
    {
        private const string OFFROAD_BASE_ADDRESS = "https://brilliant-will-93906.appspot.com/_ah/api/myAdventureApi/v1/";

        public async Task<List<Feature>> GetAll()
        {
            var address = $"{OFFROAD_BASE_ADDRESS}/getTracksByFilter?fields=items(mapItemList,track(activityType,myAdventureUserId,id,start,end,title,userMail))";
            using (var client = new HttpClient())
            {
                // this doesn't work, HM TODO: wait for Cadan's response.
                //var requestBody = new OffroadJsonRequest
                //{
                //    cycling = true,
                //    offRoading = true,
                //    walking = true
                //};
                //var response = await client.PostAsync(address, new StringContent(JsonConvert.SerializeObject(requestBody)));
                
                var response = await client.PostAsync(address, null);
                var stringContent = await response.Content.ReadAsStringAsync();
                var jsonResponse = JsonConvert.DeserializeObject<JsonOffRoadResponse>(stringContent);
                return jsonResponse.items.Select(ConvertToPointFeature).Where(f => f?.Attributes[FeatureAttributes.ICON] != null).ToList();
            }
        }

        private Feature ConvertToPointFeature(JsonOffroadItem offroadItem)
        {
            if (offroadItem.track?.start == null)
            {
                return null;
            }
            var point = new Point(new Coordinate(offroadItem.track.start.longitude, offroadItem.track.start.latitude));
            return new Feature(point, GetAttributes(offroadItem.track));
        }

        private AttributesTable GetAttributes(JsonOffroadTrack offroadTrack)
        {
            var attributes = new AttributesTable();
            attributes.AddAttribute(FeatureAttributes.ID, offroadTrack.id);
            attributes.AddAttribute(FeatureAttributes.NAME, offroadTrack.title);
            attributes.AddAttribute(FeatureAttributes.POI_SOURCE, Sources.OFFROAD);
            var geoLocation = new AttributesTable();
            geoLocation.AddAttribute(FeatureAttributes.LAT, offroadTrack.start.latitude);
            geoLocation.AddAttribute(FeatureAttributes.LON, offroadTrack.start.longitude);
            attributes.AddAttribute(FeatureAttributes.GEOLOCATION, geoLocation);
            attributes.AddAttribute(FeatureAttributes.POI_CATEGORY, GetCategory(offroadTrack.activityType));
            attributes.AddAttribute(FeatureAttributes.ICON, GetIcon(offroadTrack.myAdventureUserId));
            attributes.AddAttribute(FeatureAttributes.ICON_COLOR, "black");
            attributes.AddAttribute(FeatureAttributes.SEARCH_FACTOR, 1);
            return attributes;
        }

        private string GetCategory(string activityType)
        {
            switch (activityType)
            {
                case "Walking":
                    return Categories.ROUTE_HIKE;
                case "Cycling":
                    return Categories.ROUTE_BIKE;
                case "OffRoading":
                    return Categories.ROUTE_4X4;
                default:
                    return Categories.ROUTE_4X4;
            }
        }

        private string GetIcon(string myAdventureUserId)
        {
            switch (myAdventureUserId)
            {
                //"shaylazmi1975@gmail.com"://
                case "5766520500125696":
                    return "icon-loveil";
                    //"figo777moshe@gmail.com": //
                case  "5689717408399360":
                    return "icon-kaldanei-hashetakh";
                //"jeepolog.offroad@gmail.com": //
                case "5161452050579456":
                    return "icon-jeepolog";
                //"mapa.offroad@gmail.com"://
                case "6290631567605760":
                    return null;
                default:
                    return "icon-offroad";
            }
            // return null for unsupported sources
        }

        public async Task<FeatureCollection> GetById(string id)
        {
            JsonOffroadTrackExtended track;
            using (var client = new HttpClient())
            {
                var reponse = await client.GetAsync($"{OFFROAD_BASE_ADDRESS}/tarcks/{id}");
                var content = await reponse.Content.ReadAsStringAsync();
                track = JsonConvert.DeserializeObject<JsonOffroadTrackExtended>(content);
                // HM TODO: fill this
                //attributes.AddAttribute(FeatureAttributes.IMAGE_URL, offroadItem.picture);
                //attributes.AddAttribute(FeatureAttributes.WEBSITE, offroadItem.link);
            }
            var attributes = GetAttributes(track);
            attributes.AddAttribute(FeatureAttributes.DESCRIPTION, track.shortDescription ?? string.Empty);
            var trackLayerKey = track.trackLayerKey;
            using (var client = new HttpClient())
            {
                var response = await client.GetAsync($"{OFFROAD_BASE_ADDRESS}/trackLayers/{trackLayerKey}");
                var content = await response.Content.ReadAsStringAsync();
                var trackLayers = JsonConvert.DeserializeObject<JsonOffroadTrackLyers>(content);
                if (trackLayers.layers.Length > 1)
                {
                    // HM TODO: handle complex layers
                    //features.AddRange(offroadItem.markers.Select(ConvertToPointFeature).ToList());
                    //return new FeatureCollection(new Collection<IFeature>(features));
                    throw new NotImplementedException("Off-road complex layers need implementation");
                }
                var coordinates = trackLayers.layers.First().path.Select(p => new Coordinate(p.longitude, p.longitude)).ToArray();
                var lineString = new LineString(coordinates);
                var features = new List<IFeature> { new Feature(lineString, attributes) };
                return new FeatureCollection(new Collection<IFeature>(features));
            }

        }
    }
}
