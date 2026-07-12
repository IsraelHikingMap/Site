using System.Collections.Generic;
using IsraelHiking.Common;
using IsraelHiking.DataAccess.ElasticSearch;
using Microsoft.VisualStudio.TestTools.UnitTesting;

namespace IsraelHiking.DataAccess.Tests.ElasticSearch;

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
    public void GetBestMatchLanguage_MultipleMatchedIncludingRequested_PrefersRequestedLanguage()
    {
        var matched = new List<string>
        {
            SearchLanguageDetector.LanguageQueryName(Languages.ENGLISH),
            SearchLanguageDetector.LanguageQueryName(Languages.RUSSIAN)
        };

        var result = SearchLanguageDetector.GetBestMatchLanguage(matched, Languages.RUSSIAN);

        Assert.AreEqual(Languages.RUSSIAN, result);
    }

    [TestMethod]
    public void GetBestMatchLanguage_MultipleMatchedWithoutRequested_UsesPriorityOrder()
    {
        var matched = new List<string>
        {
            SearchLanguageDetector.LanguageQueryName(Languages.RUSSIAN),
            SearchLanguageDetector.LanguageQueryName(Languages.ENGLISH)
        };

        var result = SearchLanguageDetector.GetBestMatchLanguage(matched, Languages.HEBREW);

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
        var matched = new List<string> { "some-other-named-query" };

        var result = SearchLanguageDetector.GetBestMatchLanguage(matched, Languages.ENGLISH);

        Assert.AreEqual(Languages.ENGLISH, result);
    }

    [TestMethod]
    public void LanguageQueryName_ProducesLangPrefixedName()
    {
        Assert.AreEqual("lang:en", SearchLanguageDetector.LanguageQueryName("en"));
        Assert.AreEqual("lang:ru", SearchLanguageDetector.LanguageQueryName("ru"));
    }

    [TestMethod]
    public void LanguageQueryName_WithTier_AppendsTierSuffix()
    {
        Assert.AreEqual("lang:ru:alt", SearchLanguageDetector.LanguageQueryName("ru", "alt"));
        Assert.AreEqual("lang:en:prefix", SearchLanguageDetector.LanguageQueryName("en", "prefix"));
    }

    [TestMethod]
    public void GetBestMatchLanguage_TierSuffixedName_DetectsLanguage()
    {
        var matched = new List<string> { SearchLanguageDetector.LanguageQueryName(Languages.RUSSIAN, "prefix") };

        var result = SearchLanguageDetector.GetBestMatchLanguage(matched, Languages.ENGLISH);

        Assert.AreEqual(Languages.RUSSIAN, result);
    }

    [TestMethod]
    public void GetBestMatchLanguage_RequestedLanguageMatchedOnlyViaTierSuffix_PrefersRequested()
    {
        var matched = new List<string>
        {
            SearchLanguageDetector.LanguageQueryName(Languages.ENGLISH),
            SearchLanguageDetector.LanguageQueryName(Languages.RUSSIAN, "alt")
        };

        var result = SearchLanguageDetector.GetBestMatchLanguage(matched, Languages.RUSSIAN);

        Assert.AreEqual(Languages.RUSSIAN, result);
    }
}
