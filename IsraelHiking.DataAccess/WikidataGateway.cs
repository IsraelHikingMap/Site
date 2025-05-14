using System;
using System.Collections.Generic;
using System.Linq;
using System.Net.Http;
using System.Text.Json;
using System.Text.Json.Serialization;
using System.Threading.Tasks;
using IsraelHiking.Common;
using IsraelHiking.Common.Extensions;
using IsraelHiking.DataAccessInterfaces;
using Microsoft.Extensions.Logging;
using NetTopologySuite.Features;
using NetTopologySuite.Geometries;
using NetTopologySuite.IO;

namespace IsraelHiking.DataAccess;

internal class WikidataLiteral
{
    [JsonPropertyName("type")]
    public string Type { get; set; }
    [JsonPropertyName("value")]
    public string Value { get; set; }
}

internal class WikidataBinding
{
    [JsonPropertyName("place")]
    public WikidataLiteral Place{ get; set; }
    [JsonPropertyName("location")]
    public WikidataLiteral Location { get; set; }
    [JsonPropertyName("links")]
    public WikidataLiteral WikipediaLinks { get; set; }
    [JsonPropertyName("allLabels")]
    public WikidataLiteral Labels { get; set; }
    [JsonPropertyName("image")]
    public WikidataLiteral Image { get; set; }
}

internal class WikidataResult
{
    [JsonPropertyName("bindings")]
    public WikidataBinding[] Bindings { get; set; }
}

internal class WikidataResults
{
    [JsonPropertyName("results")]
    public WikidataResult Results { get; set; }
}
public class WikidataGateway : IWikidataGateway
{
    private const string WIKIDATA_LOGO = "https://upload.wikimedia.org/wikipedia/commons/thumb/6/66/Wikidata-logo-en.svg/128px-Wikidata-logo-en.svg.png";
    private const string QUERY_API = "https://query.wikidata.org/sparql?query=";

    private readonly WKTReader _wktReader;
    private readonly IHttpClientFactory _httpClientFactory;
    private readonly ILogger _logger;

    public WikidataGateway(IHttpClientFactory httpClientFactory, ILogger logger)
    {
        _httpClientFactory = httpClientFactory;
        _logger = logger;
        _wktReader = new WKTReader();
    }
    
    public async Task<List<IFeature>> GetByBoundingBox(Coordinate southWest, Coordinate northEast)
    {
        _logger.LogInformation($"Starting getting Wikidata items for coordinates: ({southWest.X}, {southWest.Y}), ({northEast.X}, {northEast.Y})");
        var query = "SELECT ?place ?location ?links ?image (GROUP_CONCAT(CONCAT(LANG(?label), \":\", ?label); SEPARATOR=\" | \") AS ?allLabels) WHERE {\n" +
                    "  SERVICE wikibase:box {\n" +
                    "    ?place wdt:P625 ?location.\n" +
                    $"    bd:serviceParam wikibase:cornerWest \"Point({southWest.X} {southWest.Y})\"^^geo:wktLiteral.\n" +
                    $"    bd:serviceParam wikibase:cornerEast \"Point({northEast.X} {northEast.Y})\"^^geo:wktLiteral.\n" +
                    "  }\n" +
                    "  OPTIONAL {\n" +
                    "    ?place wdt:P18 ?image.\n" +
                    "  }\n" +
                    "  ?place rdfs:label ?label .\n";
        
        foreach (var language in Languages.Array)
        {
            query += "  OPTIONAL {\n" +
                "    SERVICE wikibase:label {\n" +
                $"      bd:serviceParam wikibase:language \"{language}\".\n" +
                "    }\n" +
                $"    ?webRaw{language} schema:about ?place; schema:inLanguage \"{language}\"; schema:isPartOf <https://{language}.wikipedia.org/>;\n" +
                $"    BIND(wikibase:decodeUri(STR(?webRaw{language})) AS ?{language}).\n" +
                "  }\n\n";
        }
        var languagesCoalesce = Languages.Array.Select(l => "COALESCE(?" + l + ", \"\")");
        query += "  BIND(CONCAT(" + string.Join(",\";\",", languagesCoalesce) + ") AS ?links).\n";
        query += "}\nGROUP BY ?place ?location ?image ?links";
        var client = _httpClientFactory.CreateClient();
        client.DefaultRequestHeaders.Add("User-Agent", Branding.USER_AGENT);
        client.DefaultRequestHeaders.Add("Accept", "application/sparql-results+json");
        var response = await client.GetAsync(QUERY_API + Uri.EscapeDataString(query));
        var content = await response.Content.ReadAsStringAsync();
        if (!response.IsSuccessStatusCode)
        {
            _logger.LogError("Unable to get wikidata results:\n" + content);
            throw new Exception("Unable to get wikidata results");
        }
        var results = JsonSerializer.Deserialize<WikidataResults>(content);
        var features = results.Results.Bindings.Select(b =>
        {
            var point = _wktReader.Read(b.Location.Value);
            if (string.IsNullOrEmpty(b.WikipediaLinks?.Value))
            {
                return null;
            }
            var links = b.WikipediaLinks.Value.Split(";").Where(s => !string.IsNullOrEmpty(s)).ToArray();
            if (links.Length == 0)
            {
                return null;
            }
            var languagesTitlesAndLinks = links.Select(l => 
            (
                Language: l.Replace("https://", "").Split(".").First(),
                Title: l.Split("/").Last().Replace("_", " "),
                Link: l.Replace("_", "%20")
            )).ToArray();
            var feature = new Feature(point, new AttributesTable
            {
                {FeatureAttributes.ID, b.Place.Value.Split("/").Last()},
                {FeatureAttributes.NAME, languagesTitlesAndLinks.First().Title},
                {FeatureAttributes.POI_SOURCE, Sources.WIKIDATA},
                {FeatureAttributes.POI_CATEGORY, Categories.WIKIPEDIA},
                {FeatureAttributes.POI_LANGUAGE, languagesTitlesAndLinks.First().Language},
                {FeatureAttributes.POI_LANGUAGES, languagesTitlesAndLinks.Select(l => l.Language).ToArray()},
                {FeatureAttributes.POI_ICON, "icon-wikipedia-w"},
                {FeatureAttributes.POI_ICON_COLOR, "black"},
                {FeatureAttributes.POI_SEARCH_FACTOR, 1.0},
                {FeatureAttributes.POI_SOURCE_IMAGE_URL, WIKIDATA_LOGO}
            }) as IFeature;
            if (!string.IsNullOrWhiteSpace(b.Image?.Value))
            {
                feature.Attributes.Add(FeatureAttributes.IMAGE_URL, b.Image.Value);
                feature.Attributes[FeatureAttributes.POI_LANGUAGES] = Languages.Array;
            }
            foreach (var languageAndLabel in b.Labels.Value.Split("|").Where(l => l.Contains(':')))
            {
                var language = languageAndLabel.Split(":").First().Trim();
                var label = languageAndLabel.Split(":").Last().Trim();
                feature.Attributes.AddOrUpdate(FeatureAttributes.NAME + ":" + language, label);
            }
            for (var index = 0; index < languagesTitlesAndLinks.Length; index++)
            {
                feature.Attributes.AddOrUpdate(FeatureAttributes.NAME + ":" + languagesTitlesAndLinks[index].Language,
                    languagesTitlesAndLinks[index].Title);
                var posix = index > 0 ? index.ToString() : string.Empty;
                feature.Attributes.AddOrUpdate(FeatureAttributes.WEBSITE + posix, languagesTitlesAndLinks[index].Link);
                feature.Attributes.AddOrUpdate(FeatureAttributes.POI_SOURCE_IMAGE_URL + posix, WIKIDATA_LOGO);
            }
            feature.SetLocation(point.Coordinate);
            feature.SetTitles();
            feature.SetId();
            return feature;
        }).Where(f => f != null).ToList();

        _logger.LogInformation($"Finished getting Wikidata items, got {features.Count} items");
        return features;
    }
}