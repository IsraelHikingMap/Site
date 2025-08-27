using IsraelHiking.Common;
using IsraelHiking.Common.DataContainer;
using IsraelHiking.Common.Extensions;
using IsraelHiking.DataAccessInterfaces;
using NetTopologySuite.Features;
using NetTopologySuite.Geometries;
using System.Text.Json.Serialization;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Net.Http;
using System.Text.Json;
using System.Threading.Tasks;

namespace IsraelHiking.DataAccess;

internal class JsonNakebItem
{
    [JsonPropertyName("id")]
    public long Id { get; set; }
    [JsonPropertyName("start")]
    public LatLng Start { get; set; }
    [JsonPropertyName("title")]
    public string Title { get; set; }
    [JsonPropertyName("last_modified")]
    [JsonConverter(typeof(DateTimeConverter))]
    public DateTime LastModified { get; set; }
}

internal class JsonNakebItemExtended : JsonNakebItem
{
    [JsonPropertyName("length")]
    public double Length { get; set; }
    [JsonPropertyName("picture")]
    public string Picture { get; set; }
    [JsonPropertyName("link")]
    public string Link { get; set; }
    [JsonPropertyName("attributes")]
    public string[] Attributes { get; set; }
    [JsonPropertyName("prolog")]
    public string Prolog { get; set; }
    [JsonPropertyName("latlngs")]
    public LatLng[] Latlngs { get; set; }
    [JsonPropertyName("markers")]
    public MarkerData[] Markers { get; set; }
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
        var nakebItem = JsonSerializer.Deserialize<List<JsonNakebItem>>(content);
        return nakebItem.Select(ConvertToPointFeature).ToList();
    }

    public async Task<Feature> GetById(string id)
    {
        var client = _httpClientFactory.CreateClient();
        var reponse = await client.GetAsync($"{NAKEB_BASE_ADDRESS}/{id}");
        var content = await reponse.Content.ReadAsStringAsync();
        var nakebItem = JsonSerializer.Deserialize<JsonNakebItemExtended>(content);
        var attributes = GetAttributes(nakebItem);
        var description = nakebItem.Prolog ?? string.Empty;
        if (!description.EndsWith("."))
        {
            description += ".";
        }
        description += $"\n{string.Join(", ", nakebItem.Attributes)}.";
        attributes.Add(FeatureAttributes.DESCRIPTION, description);
        attributes.Add(FeatureAttributes.DESCRIPTION + ":" + Languages.HEBREW, description);
        attributes.Add(FeatureAttributes.IMAGE_URL, nakebItem.Picture);
        attributes.Add(FeatureAttributes.WEBSITE, nakebItem.Link);
        attributes.Add(FeatureAttributes.POI_SOURCE_IMAGE_URL, NAKEB_LOGO);
        var lineString = new LineString(nakebItem.Latlngs.Select(l => l.ToCoordinate()).ToArray());
        // Ignoring markers for simplification
        var feature = new Feature(lineString, attributes);
        feature.SetId();
        return feature;
    }

    private Feature ConvertToPointFeature(JsonNakebItem nakebItem)
    {
        var point = new Point(nakebItem.Start.ToCoordinate());
        return new Feature(point, GetAttributes(nakebItem));
    }

    private AttributesTable GetAttributes(JsonNakebItem nakebItem)
    {
        var attributes = new AttributesTable
        {
            {FeatureAttributes.ID, nakebItem.Id.ToString()},
            {FeatureAttributes.NAME, nakebItem.Title},
            {FeatureAttributes.NAME + ":" + Languages.HEBREW, nakebItem.Title},
            {FeatureAttributes.POI_SOURCE, Sources.NAKEB},
            {FeatureAttributes.POI_CATEGORY, Categories.ROUTE_HIKE},
            {FeatureAttributes.POI_LANGUAGE, Languages.HEBREW},
            {FeatureAttributes.POI_LANGUAGES, new [] {Languages.HEBREW}},
            {FeatureAttributes.POI_ICON, "icon-hike"},
            {FeatureAttributes.POI_ICON_COLOR, "black"},
            {FeatureAttributes.POI_SEARCH_FACTOR, 1.0}
        };
        attributes.SetLastModified(nakebItem.LastModified);
        attributes.SetLocation(new Coordinate(nakebItem.Start.Lng, nakebItem.Start.Lat));
        return attributes;
    }
}