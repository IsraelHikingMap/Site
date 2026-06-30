using System.Collections.Generic;
using IsraelHiking.Common;
using IsraelHiking.DataAccess.ElasticSearch;
using Microsoft.VisualStudio.TestTools.UnitTesting;

namespace IsraelHiking.DataAccess.Tests.ElasticSearch;

/// <summary>
/// Story 0.6 AC1 (FR-5.1) — behavioral unit for the named-query language detection.
///
/// These exercise the <c>MatchedQueries -> language</c> mapping directly (ES-free), locking in the
/// supported detection path. The complementary explain-tree-free source guard lives in
/// <see cref="LanguageDetectionExplainFreeGuardTests"/>. The live gateway Search* tests stay
/// <c>[Ignore]</c>d (they need a real cluster), so these are the runnable AC1 gate.
/// </summary>
[TestClass]
public class SearchLanguageDetectorTests
{
    [TestMethod]
    public void GetBestMatchLanguage_SingleLanguageMatched_ReturnsThatLanguage()
    {
        var matched = new List<string> { SearchLanguageDetector.LanguageQueryName(Languages.RUSSIAN) };

        var result = SearchLanguageDetector.GetBestMatchLanguage(matched, Languages.ENGLISH);

        Assert.AreEqual(Languages.RUSSIAN, result);
    }

    [TestMethod]
    public void GetBestMatchLanguage_MultipleMatched_PrefersDefaultPriorityOrder()
    {
        // Both English (the default) and Russian matched; ArrayWithDefault puts the default first,
        // so detection must resolve to English — preserving the previous First(...) semantics.
        var matched = new List<string>
        {
            SearchLanguageDetector.LanguageQueryName(Languages.ENGLISH),
            SearchLanguageDetector.LanguageQueryName(Languages.RUSSIAN)
        };

        var result = SearchLanguageDetector.GetBestMatchLanguage(matched, Languages.RUSSIAN);

        Assert.AreEqual(Languages.ENGLISH, result);
    }

    [TestMethod]
    public void GetBestMatchLanguage_EmptyMatchedQueries_ReturnsFallback()
    {
        var result = SearchLanguageDetector.GetBestMatchLanguage(new List<string>(), Languages.HEBREW);

        Assert.AreEqual(Languages.HEBREW, result);
    }

    [TestMethod]
    public void GetBestMatchLanguage_NullMatchedQueries_ReturnsFallback()
    {
        var result = SearchLanguageDetector.GetBestMatchLanguage(null, Languages.HEBREW);

        Assert.AreEqual(Languages.HEBREW, result);
    }

    [TestMethod]
    public void GetBestMatchLanguage_NoLanguageClauseMatched_ReturnsFallback()
    {
        // A matched query that is not a "lang:<l>" name (e.g. some other named clause) must not be
        // mistaken for a language signal.
        var matched = new List<string> { "some-other-named-query" };

        var result = SearchLanguageDetector.GetBestMatchLanguage(matched, Languages.ENGLISH);

        Assert.AreEqual(Languages.ENGLISH, result);
    }

    [TestMethod]
    public void LanguageQueryName_ProducesLangPrefixedName()
    {
        // The positive mechanism: per-language clauses are NAMED "lang:<l>" so MatchedQueries can
        // carry the signal. If this prefix changes, the source guard's name-present check must too.
        Assert.AreEqual("lang:en", SearchLanguageDetector.LanguageQueryName("en"));
        Assert.AreEqual("lang:ru", SearchLanguageDetector.LanguageQueryName("ru"));
    }
}
