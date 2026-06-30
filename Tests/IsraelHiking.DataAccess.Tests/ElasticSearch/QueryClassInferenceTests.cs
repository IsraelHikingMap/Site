using System.Collections.Generic;
using System.Linq;
using Microsoft.VisualStudio.TestTools.UnitTesting;
using IsraelHiking.DataAccess.ElasticSearch;

namespace IsraelHiking.DataAccess.Tests.ElasticSearch;

/// <summary>
/// Unit tests for the query-class inference that drives the painless prominence weighting (qtype) and
/// the feature-class similarity boost (query_classes). These run without a live cluster — they exercise
/// the static token vocabulary directly. Expected values are derived from the documented vocabulary, not
/// from the implementation's own output.
/// </summary>
[TestClass]
public class QueryClassInferenceTests
{
    // ---- InferQueryClass: feature_class(es) a query intends ----

    [TestMethod]
    public void InferQueryClass_LeadingTypeToken_Mount_ReturnsPeak()
    {
        CollectionAssert.AreEqual(new[] { "peak" },
            ElasticSearchGateway.InferQueryClass("Mount Denali").ToArray());
    }

    [TestMethod]
    public void InferQueryClass_TrailingTypeToken_Lake_ReturnsWaterBodies()
    {
        CollectionAssert.AreEqual(new[] { "lake", "reservoir", "pond" },
            ElasticSearchGateway.InferQueryClass("Silver Lake").ToArray());
    }

    [TestMethod]
    public void InferQueryClass_MultiWordPhraseToken_HotSpring_ReturnsSpring()
    {
        CollectionAssert.AreEqual(new[] { "spring" },
            ElasticSearchGateway.InferQueryClass("Calistoga hot spring").ToArray());
    }

    [TestMethod]
    public void InferQueryClass_PluralFoldedToSingular_Springs_ReturnsSpring()
    {
        // "springs" folds to the "spring" key (NormalizeClassToken trailing-s rule).
        CollectionAssert.AreEqual(new[] { "spring" },
            ElasticSearchGateway.InferQueryClass("Glenwood Springs").ToArray());
    }

    [TestMethod]
    public void InferQueryClass_NoTypeToken_ReturnsEmpty()
    {
        Assert.AreEqual(0, ElasticSearchGateway.InferQueryClass("Denali").Count);
    }

    [TestMethod]
    public void InferQueryClass_EmptyOrWhitespace_ReturnsEmpty()
    {
        Assert.AreEqual(0, ElasticSearchGateway.InferQueryClass("").Count);
        Assert.AreEqual(0, ElasticSearchGateway.InferQueryClass("   ").Count);
        Assert.AreEqual(0, ElasticSearchGateway.InferQueryClass(null).Count);
    }

    // ---- InferQtype: GENERIC (bare category) vs SPECIFIC (named feature) ----

    [TestMethod]
    public void InferQtype_BareCategoryWord_IsGeneric()
    {
        Assert.AreEqual("GENERIC", ElasticSearchGateway.InferQtype("lake"));
    }

    [TestMethod]
    public void InferQtype_BareCategoryPhrase_IsGeneric()
    {
        Assert.AreEqual("GENERIC", ElasticSearchGateway.InferQtype("hot springs"));
    }

    [TestMethod]
    public void InferQtype_NamedFeature_IsSpecific()
    {
        // "Silver" is not a type token, so the whole query is a named feature.
        Assert.AreEqual("SPECIFIC", ElasticSearchGateway.InferQtype("Silver Lake"));
    }

    [TestMethod]
    public void InferQtype_ProperNoun_IsSpecific()
    {
        Assert.AreEqual("SPECIFIC", ElasticSearchGateway.InferQtype("Denali"));
    }

    [TestMethod]
    public void InferQtype_EmptyOrWhitespace_DefaultsToGeneric()
    {
        Assert.AreEqual("GENERIC", ElasticSearchGateway.InferQtype(""));
        Assert.AreEqual("GENERIC", ElasticSearchGateway.InferQtype("   "));
        Assert.AreEqual("GENERIC", ElasticSearchGateway.InferQtype(null));
    }

    [TestMethod]
    public void InferQtype_StripsEdgePunctuation()
    {
        // Quotes/commas at the edges must not flip the classification.
        Assert.AreEqual("GENERIC", ElasticSearchGateway.InferQtype("\"lake\""));
    }
}
