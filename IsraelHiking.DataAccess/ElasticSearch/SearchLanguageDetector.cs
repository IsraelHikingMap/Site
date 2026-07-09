using System.Collections.Generic;
using System.Linq;
using IsraelHiking.Common;

namespace IsraelHiking.DataAccess.ElasticSearch;

internal static class SearchLanguageDetector
{
    internal static string LanguageQueryName(string language) => "lang:" + language;

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
