using IsraelHiking.Common;
using IsraelHiking.DataAccessInterfaces;
using Microsoft.Extensions.Logging;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Net.Http;
using System.Net.Http.Json;
using System.Text.Json.Serialization;
using System.Threading.Tasks;

namespace IsraelHiking.DataAccess;

class WikidataEntity
{
    [JsonPropertyName("sitelinks")]
    public Dictionary<string, WikidataSitelink> Sitelinks { get; set; }
    [JsonPropertyName("statements")]
    public Dictionary<string, List<WikidataStatement>> Statements { get; set; }
}

class WikidataSitelink
{
    [JsonPropertyName("title")]
    public string Title { get; set; }
}

class WikidataStatement
{
    [JsonPropertyName("value")]
    public WikidataStatementValue Value { get; set; }
}

class WikidataStatementValue
{
    [JsonPropertyName("content")]
    public string Content { get; set; }
}

class WikiQueryResponse
{
    [JsonPropertyName("query")]
    public WikiQuery Query { get; set; }
}

class WikiQuery
{
    [JsonPropertyName("pages")]
    public Dictionary<string, WikiPage> Pages { get; set; }
}

class WikiPage
{
    [JsonPropertyName("extract")]
    public string Extract { get; set; }
    [JsonPropertyName("original")]
    public WikiImageSource Original { get; set; }
    [JsonPropertyName("imageinfo")]
    public List<WikiImageInfo> ImageInfo { get; set; }
}

class WikiImageSource
{
    [JsonPropertyName("source")]
    public string Source { get; set; }
}

class WikiImageInfo
{
    [JsonPropertyName("url")]
    public string Url { get; set; }
}

/// <summary>
/// Fetches description and image for a POI from Wikidata + Wikipedia, mirroring what the client does.
/// </summary>
public class WikidataGateway(IHttpClientFactory httpClientFactory, ILogger logger) : IWikidataGateway
{
    /// <inheritdoc/>
    public async Task<WikidataContent> GetContent(string wikidataId)
    {
        var result = new WikidataContent();
        try
        {
            var client = httpClientFactory.CreateClient();
            var entity = await client.GetFromJsonAsync<WikidataEntity>(
                $"https://www.wikidata.org/w/rest.php/wikibase/v1/entities/items/{wikidataId}");
            if (entity?.Sitelinks != null)
            {
                foreach (var language in Languages.Array)
                {
                    var title = entity.Sitelinks.GetValueOrDefault($"{language}wiki")?.Title;
                    if (string.IsNullOrEmpty(title))
                    {
                        continue;
                    }
                    var (description, image) = await GetWikipediaExtractAndImage(client, language, title);
                    if (!string.IsNullOrWhiteSpace(description))
                    {
                        result.DescriptionByLanguage[language] = description;
                    }
                    if (string.IsNullOrWhiteSpace(result.ImageUrl) && !string.IsNullOrWhiteSpace(image))
                    {
                        result.ImageUrl = image;
                    }
                }
            }
            if (string.IsNullOrWhiteSpace(result.ImageUrl))
            {
                var imageFile = entity?.Statements?.GetValueOrDefault("P18")?.FirstOrDefault()?.Value?.Content;
                if (!string.IsNullOrEmpty(imageFile))
                {
                    result.ImageUrl = await GetCommonsImageUrl(client, imageFile);
                }
            }
        }
        catch (Exception ex)
        {
            logger.LogWarning(ex, $"Failed to fetch Wikidata content for {wikidataId}");
        }
        return result;
    }

    private static async Task<(string description, string image)> GetWikipediaExtractAndImage(HttpClient client, string language, string title)
    {
        var url = $"https://{language}.wikipedia.org/w/api.php?format=json&action=query&prop=extracts|pageimages&piprop=original&exintro=&redirects=1&explaintext=&titles={Uri.EscapeDataString(title)}";
        var response = await client.GetFromJsonAsync<WikiQueryResponse>(url);
        var page = response?.Query?.Pages?.Values.FirstOrDefault();
        return (page?.Extract, page?.Original?.Source);
    }

    private static async Task<string> GetCommonsImageUrl(HttpClient client, string fileName)
    {
        var url = $"https://commons.wikimedia.org/w/api.php?action=query&titles=File:{Uri.EscapeDataString(fileName)}&prop=imageinfo&iiprop=url&redirects&format=json";
        var response = await client.GetFromJsonAsync<WikiQueryResponse>(url);
        var page = response?.Query?.Pages?.Values.FirstOrDefault();
        return page?.ImageInfo?.FirstOrDefault()?.Url;
    }
}
