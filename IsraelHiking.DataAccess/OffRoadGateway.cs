using System;
using System.Collections.Generic;
using System.Collections.ObjectModel;
using System.Linq;
using System.Net.Http;
using System.Text;
using System.Threading.Tasks;
using GeoAPI.Geometries;
using IsraelHiking.Common;
using IsraelHiking.DataAccessInterfaces;
using NetTopologySuite.Features;
using NetTopologySuite.Geometries;
using Newtonsoft.Json;

namespace IsraelHiking.DataAccess
{
    internal class JsonOffRoadRequest
    {
        public bool easy { get; set; }
        public bool hard { get; set; }
        public bool moderate { get; set; }
        public bool cycling { get; set; }
        public bool driving { get; set; }
        public bool offRoading { get; set; }
        public bool sailing { get; set; }
        public bool walking { get; set; }
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

    internal class JsonUrlAndTitle
    {
        public string url { get; set; }
        public string title { get; set; }
    }

    internal class JsonOffroadTrack
    {
        public JsonLatLang start { get; set; }
        public JsonLatLang end { get; set; }
        public string title { get; set; }
        public string id { get; set; }
        public string activityType { get; set; }
        public string userId { get; set; }
        public string myAdventureUserId { get; set; }
    }

    internal class JsonOffroadTrackExtended : JsonOffroadTrack
    {
        public string shortDescription { get; set; }
        public string trackLayerKey { get; set; }
        public string externalUrl { get; set; }
        public string iconUrl { get; set; }
        public JsonUrlAndTitle[] galleryImages { get; set; }
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
        private const string OFFROAD_BASE_ADDRESS = "https://brilliant-will-93906.appspot.com/_ah/api/myAdventureApi/v1";

        public async Task<List<Feature>> GetAll()
        {
            // Need to split due to issues in off-road server
            var tasks = new []
            {
                GetForCategory(new JsonOffRoadRequest {offRoading = true, hard = true, moderate = true, easy = true}),
                GetForCategory(new JsonOffRoadRequest {cycling = true, hard = true, moderate = true, easy = true}),
                GetForCategory(new JsonOffRoadRequest {walking = true, hard = true, moderate = true, easy = true})
            };
            var results = await Task.WhenAll(tasks);
            return results.SelectMany(l => l).ToList();
        }

        private async Task<List<Feature>> GetForCategory(JsonOffRoadRequest request)
        {
            var address = $"{OFFROAD_BASE_ADDRESS}/getTracksByFilter?fields=items(mapItemList,track(activityType,myAdventureUserId,id,start,end,title,userMail))";
            using (var client = new HttpClient())
            {
                var ignoredUsers = new[]
                {
                    "6290631567605760", // Mapa
                    "6214979527114752", // Nakeb
                    //"6221031622574080" // KKL - keeping it here and ignoring OSM data.
                };
                var requestString = JsonConvert.SerializeObject(request);
                var response = await client.PostAsync(address, new StringContent(requestString, Encoding.UTF8, "application/json"));
                var stringContent = await response.Content.ReadAsStringAsync();
                var jsonResponse = JsonConvert.DeserializeObject<JsonOffRoadResponse>(stringContent);
                return jsonResponse.items
                    .Where(i => ignoredUsers.Contains(i.track.myAdventureUserId) == false)
                    .Select(ConvertToPointFeature)
                    .Where(f => f != null)
                    .ToList();
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
            var geoLocation = new AttributesTable
            {
                {FeatureAttributes.LAT, offroadTrack.start.latitude},
                {FeatureAttributes.LON, offroadTrack.start.longitude}
            };
            var category = GetCategory(offroadTrack.activityType);
            var attributes = new AttributesTable
            {
                {FeatureAttributes.ID, offroadTrack.id},
                {FeatureAttributes.NAME, offroadTrack.title},
                {FeatureAttributes.POI_SOURCE, Sources.OFFROAD},
                {FeatureAttributes.POI_CATEGORY, category},
                {FeatureAttributes.POI_TYPE, string.Empty},
                {FeatureAttributes.ICON, GetIconByCategory(category)},
                {FeatureAttributes.ICON_COLOR, "black"},
                {FeatureAttributes.SEARCH_FACTOR, 1},
                {FeatureAttributes.GEOLOCATION, geoLocation}
            };
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

        private string GetIconByCategory(string category)
        {
            switch (category)
            {
                case Categories.ROUTE_HIKE:
                    return "icon-hike";
                case Categories.ROUTE_BIKE:
                    return "icon-bike";
                default:
                    return "icon-four-by-four";
            }
        }

        public async Task<FeatureCollection> GetById(string id)
        {
            JsonOffroadTrackExtended track;
            using (var client = new HttpClient())
            {
                var reponse = await client.GetAsync($"{OFFROAD_BASE_ADDRESS}/tracks/{id}");
                var content = await reponse.Content.ReadAsStringAsync();
                track = JsonConvert.DeserializeObject<JsonOffroadTrackExtended>(content);
            }
            var attributes = GetAttributes(track);
            attributes.Add(FeatureAttributes.DESCRIPTION, track.shortDescription ?? string.Empty);
            attributes.Add(FeatureAttributes.IMAGE_URL, track.galleryImages?.FirstOrDefault()?.url ?? string.Empty);
            var externalUrl = track.externalUrl != null && track.externalUrl.Contains("internal.off-road.io") == false
                ? track.externalUrl
                : string.Empty;
            attributes.Add(FeatureAttributes.WEBSITE, externalUrl);
            var imageSourceUrl = track.iconUrl ?? string.Empty;
            attributes.Add(FeatureAttributes.SOURCE_IMAGE_URL, imageSourceUrl);
            var trackLayerKey = track.trackLayerKey;
            using (var client = new HttpClient())
            {
                var response = await client.GetAsync($"{OFFROAD_BASE_ADDRESS}/trackLayers/{trackLayerKey}");
                var content = await response.Content.ReadAsStringAsync();
                var trackLayers = JsonConvert.DeserializeObject<JsonOffroadTrackLyers>(content);
                if (trackLayers.layers.Length > 1)
                {
                    throw new NotImplementedException("Off-road complex layers need implementation");
                }
                var coordinates = trackLayers.layers.First().path.Select(p => new Coordinate(p.longitude, p.latitude)).ToArray();
                var lineString = new LineString(coordinates);
                var features = new List<IFeature> { new Feature(lineString, attributes) };
                return new FeatureCollection(new Collection<IFeature>(features));
            }

        }
    }
}
