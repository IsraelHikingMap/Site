using System.Collections.Generic;
using System.Linq;
using IsraelHiking.Common;

namespace IsraelHiking.DataAccess.ElasticSearch;

/// <summary>
/// Detects the matched search language from NEST named queries. Read from <c>hit.MatchedQueries</c>
/// against per-language clauses named <c>"lang:&lt;l&gt;"</c> (not the explain tree, which a
/// <c>function_score</c> wrapper reshapes). Extracted from <see cref="ElasticSearchGateway"/> for unit testing.
/// </summary>
internal static class SearchLanguageDetector
{
    /// <summary>Named-query label for a per-language phrase clause, e.g. "lang:en".</summary>
    internal static string LanguageQueryName(string language) => "lang:" + language;

    /// <summary>
    /// Best-matching language for a hit from the names of matched sub-queries. Priority follows
    /// <see cref="Languages.ArrayWithDefault"/> (default first); falls back to <paramref name="fallbackLanguage"/>.
    /// </summary>
    /// <param name="matchedQueries">The names of the named sub-queries that matched this hit.</param>
    /// <param name="fallbackLanguage">The language to use when no language clause matched.</param>
    internal static string GetBestMatchLanguage(IReadOnlyCollection<string> matchedQueries, string fallbackLanguage)
    {
        if (matchedQueries == null || matchedQueries.Count == 0)
        {
            return fallbackLanguage;
        }
        foreach (var l in Languages.ArrayWithDefault)
        {
            if (matchedQueries.Contains(LanguageQueryName(l)))
            {
                return l;
            }
        }
        return fallbackLanguage;
    }
}
