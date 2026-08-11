using System.Collections.Generic;
using System.Threading.Tasks;

namespace IsraelHiking.DataAccessInterfaces;

/// <summary>
/// Fetches point-of-interest content (description and a single image) from Wikidata/Wikipedia.
/// </summary>
public interface IWikidataGateway
{
    /// <summary>
    /// Resolves a Wikidata entity to per-language descriptions and a single image URL.
    /// </summary>
    /// <param name="wikidataId">The Wikidata id, e.g. Q12345</param>
    Task<WikidataContent> GetContent(string wikidataId);
}

/// <summary>
/// The minimal content the crawler needs from Wikidata/Wikipedia.
/// </summary>
public class WikidataContent
{
    /// <summary>Description text keyed by language code (e.g. "he", "en").</summary>
    public Dictionary<string, string> DescriptionByLanguage { get; } = [];
    /// <summary>A single representative image URL, if any was found.</summary>
    public string ImageUrl { get; set; }
}
