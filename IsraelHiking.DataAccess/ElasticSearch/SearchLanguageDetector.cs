using System.Collections.Generic;
using System.Linq;
using IsraelHiking.Common;

namespace IsraelHiking.DataAccess.ElasticSearch;

public static class SearchLanguageDetector
{
    private const string LANGUAGE_QUERY_PREFIX = "lang:";

    public static string LanguageQueryName(string language) => LANGUAGE_QUERY_PREFIX + language;

    public static string LanguageQueryName(string language, string tier) =>
        LANGUAGE_QUERY_PREFIX + language + ":" + tier;

    public static string GetBestMatchLanguage(IReadOnlyCollection<string> matchedQueries, string fallbackLanguage)
    {
        if (matchedQueries == null || matchedQueries.Count == 0)
        {
            return fallbackLanguage;
        }
        if (LanguageMatched(matchedQueries, fallbackLanguage))
        {
            return fallbackLanguage;
        }
        foreach (var l in Languages.ArrayWithDefault)
        {
            if (LanguageMatched(matchedQueries, l))
            {
                return l;
            }
        }
        return fallbackLanguage;
    }

    private static bool LanguageMatched(IReadOnlyCollection<string> matchedQueries, string language)
    {
        return matchedQueries.Any(m => m == LanguageQueryName(language) || m.StartsWith(LanguageQueryName(language) + ":"));
    }
}
