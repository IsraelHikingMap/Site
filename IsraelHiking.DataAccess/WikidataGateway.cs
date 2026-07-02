using IsraelHiking.Common;
using IsraelHiking.DataAccessInterfaces;
using Microsoft.Extensions.Logging;
using System;
using System.Linq;
using System.Net.Http;
using System.Text.Json.Nodes;
using System.Threading.Tasks;

namespace IsraelHiking.DataAccess;

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
            var entityJson = await client.GetStringAsync($"https://www.wikidata.org/w/rest.php/wikibase/v1/entities/items/{wikidataId}");
            var entity = JsonNode.Parse(entityJson);
            var sitelinks = entity?["sitelinks"]?.AsObject();
            if (sitelinks != null)
            {
                foreach (var language in Languages.Array)
                {
                    var title = sitelinks[$"{language}wiki"]?["title"]?.GetValue<string>();
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
                var imageFile = entity?["statements"]?["P18"]?[0]?["value"]?["content"]?.GetValue<string>();
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
        var json = await client.GetStringAsync(url);
        var page = JsonNode.Parse(json)?["query"]?["pages"]?.AsObject().Select(p => p.Value).FirstOrDefault();
        return (page?["extract"]?.GetValue<string>(), page?["original"]?["source"]?.GetValue<string>());
    }

    private static async Task<string> GetCommonsImageUrl(HttpClient client, string fileName)
    {
        var url = $"https://commons.wikimedia.org/w/api.php?action=query&titles=File:{Uri.EscapeDataString(fileName)}&prop=imageinfo&iiprop=url&redirects&format=json";
        var json = await client.GetStringAsync(url);
        var page = JsonNode.Parse(json)?["query"]?["pages"]?.AsObject().Select(p => p.Value).FirstOrDefault();
        return page?["imageinfo"]?[0]?["url"]?.GetValue<string>();
    }
}
