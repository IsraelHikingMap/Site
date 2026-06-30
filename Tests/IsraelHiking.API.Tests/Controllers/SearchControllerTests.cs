using IsraelHiking.API.Controllers;
using IsraelHiking.Common;
using IsraelHiking.Common.Extensions;
using IsraelHiking.DataAccessInterfaces.Repositories;
using Microsoft.VisualStudio.TestTools.UnitTesting;
using NetTopologySuite.Features;
using NetTopologySuite.Geometries;
using NSubstitute;
using System.Collections.Generic;
using System.Linq;

namespace IsraelHiking.API.Tests.Controllers;

[TestClass]
public class SearchControllerTests
{
    private ISearchRepository _searchRepository;
    private SearchController _controller;

    [TestInitialize]
    public void TestInitialize()
    {
        _searchRepository = Substitute.For<ISearchRepository>();
        _controller = new SearchController(_searchRepository);
    }

    [TestMethod]
    public void GetSearchResults_ShouldPassRequestToGateway_NoResultsFound()
    {
        var list = new List<IFeature>();
        var searchTerm = "searchTerm";
        _searchRepository.Search(searchTerm, Languages.ENGLISH).Returns(list);

        var results = _controller.GetSearchResults(searchTerm, Languages.ENGLISH).Result;

        Assert.IsNotNull(results);
        Assert.AreEqual(list.Count, results.Count());
    }

    [TestMethod]
    public void GetSearchResults_SearchWillReturnedDifferentLanguage_UseIt()
    {
        var featureLocation = new Coordinate(0, 0);
        var feature = new Feature(new Point(featureLocation), new AttributesTable
        {
            {FeatureAttributes.NAME, "name"},
            {FeatureAttributes.NAME + ":ru", "name-russian"},
            {FeatureAttributes.POI_CATEGORY, Categories.HISTORIC},
            {FeatureAttributes.POI_SOURCE, Sources.OSM},
            {FeatureAttributes.POI_ICON, string.Empty},
            {FeatureAttributes.POI_ICON_COLOR, "black"},
            {FeatureAttributes.ID, "id"},
            {FeatureAttributes.SEARCH_LANGUAGE, Languages.RUSSIAN}
        });
        feature.SetLocation(featureLocation);
        var list = new List<IFeature> { feature };
        var searchTerm = "searchTerm";
        _searchRepository.Search(searchTerm, Languages.ENGLISH).Returns(list);

        var results = _controller.GetSearchResults(searchTerm, Languages.ENGLISH).Result;

        Assert.IsNotNull(results);
        Assert.AreEqual(list.Count, results.Count());
        Assert.AreEqual("name-russian", results.First().Title);
    }

    [TestMethod]
    public void GetSearchResults_SearchWillReturnedDefaultLanguage_UseIt()
    {
        var featureLocation = new Coordinate(0, 0);
        var feature = new Feature(new Point(featureLocation), new AttributesTable
        {
            {FeatureAttributes.NAME, "name"},
            {FeatureAttributes.NAME + ":ru", "name-russian"},
            {FeatureAttributes.NAME + ":en", "name-english"},
            {FeatureAttributes.POI_CATEGORY, Categories.HISTORIC},
            {FeatureAttributes.POI_SOURCE, Sources.OSM},
            {FeatureAttributes.POI_ICON, string.Empty},
            {FeatureAttributes.POI_ICON_COLOR, "black"},
            {FeatureAttributes.ID, "id"},
            {FeatureAttributes.SEARCH_LANGUAGE, Languages.DEFAULT}
        });
        feature.SetLocation(featureLocation);
        var list = new List<IFeature> { feature };
        var searchTerm = "searchTerm";
        _searchRepository.Search(searchTerm, Languages.ENGLISH).Returns(list);

        var results = _controller.GetSearchResults(searchTerm, Languages.ENGLISH).Result;

        Assert.IsNotNull(results);
        Assert.AreEqual(list.Count, results.Count());
        Assert.AreEqual("name", results.First().Title);
    }

    [TestMethod]
    public void GetSearchResults_UsingQuotes_ShouldGetExactMatch()
    {
        var list = new List<IFeature>();
        var searchTerm = "\"searchTerm\"";
        _searchRepository.SearchExact(Arg.Any<string>(), Languages.ENGLISH).Returns(list);

        var results = _controller.GetSearchResults(searchTerm, Languages.ENGLISH).Result;

        Assert.IsNotNull(results);
        Assert.AreEqual(list.Count, results.Count());
        _searchRepository.Received(1).SearchExact(Arg.Any<string>(), Languages.ENGLISH);
    }

    [TestMethod]
    public void GetSearchResults_WithPlaceNameThatDoNotExist_ShouldReturnRegularResults()
    {
        const string place = "place";
        const string searchTerm = "searchTerm, " + place;
        var featureLocation = new Coordinate(0.5, 0.5);
        var featureInPlace = new Feature(new Point(featureLocation), new AttributesTable
        {
            {FeatureAttributes.NAME, "name"},
            {FeatureAttributes.POI_CATEGORY, Categories.HISTORIC},
            {FeatureAttributes.POI_SOURCE, Sources.OSM},
            {FeatureAttributes.POI_ICON, string.Empty},
            {FeatureAttributes.POI_ICON_COLOR, "black"},
            {FeatureAttributes.ID, "id"},
            {FeatureAttributes.SEARCH_LANGUAGE, Languages.ENGLISH}
        });
        featureInPlace.SetLocation(featureLocation);
        var featuresInsidePlace = new List<Feature> { featureInPlace };
        _searchRepository.SearchPlaces(searchTerm, Languages.ENGLISH).Returns([]);
        _searchRepository.Search("searchTerm", Languages.ENGLISH).Returns([featureInPlace]);
        _searchRepository.GetContainerName([featureLocation], Languages.ENGLISH).Returns(string.Empty);

        var results = _controller.GetSearchResults(searchTerm, Languages.ENGLISH).Result.ToList();

        Assert.IsNotNull(results);
        Assert.AreEqual(featuresInsidePlace.Count, results.Count);
        Assert.IsFalse(results.First().DisplayName.Contains(place));
    }

    [TestMethod]
    public void GetSearchResults_WithPlaceName_ShouldSearchOnlyPlacesInThatPlace()
    {
        const string place = "place";
        const string searchTerm = "searchTerm, " + place;
        var placeFeature = new Feature(new Polygon(new LinearRing([
            new Coordinate(0, 0),
            new Coordinate(0, 1),
            new Coordinate(2, 0),
            new Coordinate(0, 0)
        ])), new AttributesTable
        {
            {FeatureAttributes.NAME, place},
            {FeatureAttributes.ID, "place_id" }
        });
        var featureLocation = new Coordinate(0.5, 0.5);
        var featureInPlace = new Feature(new Point(featureLocation), new AttributesTable
        {
            {FeatureAttributes.NAME, "name"},
            {FeatureAttributes.POI_CATEGORY, Categories.HISTORIC},
            {FeatureAttributes.POI_SOURCE, Sources.OSM},
            {FeatureAttributes.POI_ICON, string.Empty},
            {FeatureAttributes.POI_ICON_COLOR, "black"},
            {FeatureAttributes.ID, "id"},
            {FeatureAttributes.SEARCH_LANGUAGE, Languages.ENGLISH}
        });
        featureInPlace.SetLocation(featureLocation);
        var featuresInsidePlace = new List<IFeature> { featureInPlace };
        _searchRepository.SearchPlaces(searchTerm, Languages.ENGLISH).Returns(featuresInsidePlace);
        _searchRepository.GetContainerName(Arg.Any<Coordinate[]>(), Languages.ENGLISH).Returns(placeFeature.GetTitle(Languages.ENGLISH));

        var results = _controller.GetSearchResults(searchTerm, Languages.ENGLISH).Result.ToList();

        Assert.IsNotNull(results);
        Assert.AreEqual(featuresInsidePlace.Count, results.Count);
        Assert.IsTrue(results.First().DisplayName.Contains(place));
    }

    [TestMethod]
    public void GetSearchResults_GeometryCollection_ShouldNotFail()
    {
        const string place = "place";
        const string searchTerm = "searchTerm, " + place;
        var placeFeature = new Feature(new Polygon(new LinearRing([
            new Coordinate(0, 0),
            new Coordinate(0, 1),
            new Coordinate(2, 0),
            new Coordinate(0, 0)
        ])), new AttributesTable
        {
            {FeatureAttributes.NAME, place},
            {FeatureAttributes.ID, "place_id" }
        });
        var featureLocation = new Coordinate(0.5, 0.5);
        var featureInPlace = new Feature(new GeometryCollection([
                new Point(featureLocation)
            ]), new AttributesTable
            {
                {FeatureAttributes.NAME, "name"},
                {FeatureAttributes.POI_CATEGORY, Categories.HISTORIC},
                {FeatureAttributes.POI_SOURCE, Sources.OSM},
                {FeatureAttributes.POI_ICON, string.Empty},
                {FeatureAttributes.POI_ICON_COLOR, "black"},
                {FeatureAttributes.ID, "id"},
                {FeatureAttributes.SEARCH_LANGUAGE, Languages.ENGLISH}
            }
        );
        featureInPlace.SetLocation(featureLocation);
        var featuresInsidePlace = new List<IFeature> { featureInPlace };
        _searchRepository.SearchPlaces(searchTerm, Languages.ENGLISH).Returns(featuresInsidePlace);
        _searchRepository.GetContainerName(Arg.Any<Coordinate[]>(), Arg.Any<string>()).Returns(placeFeature.GetTitle(Languages.ENGLISH));

        var results = _controller.GetSearchResults(searchTerm, Languages.ENGLISH).Result.ToList();

        Assert.IsNotNull(results);
        Assert.AreEqual(featuresInsidePlace.Count, results.Count);
        Assert.IsTrue(results.First().DisplayName.Contains(place));
    }

    [TestMethod]
    public void GetSearchResults_GeometryCollectionNoContainers_ShouldNotFail()
    {
        const string place = "place";
        const string searchTerm = "searchTerm, " + place;
        var featureLocation = new Coordinate(0.5, 0.5);
        var featureInPlace = new Feature(new GeometryCollection([
                new Point(featureLocation),
                new LineString([new Coordinate(0,0), new Coordinate(3,3)])
            ]), new AttributesTable
            {
                {FeatureAttributes.NAME, "name"},
                {FeatureAttributes.POI_CATEGORY, Categories.HISTORIC},
                {FeatureAttributes.POI_SOURCE, Sources.OSM},
                {FeatureAttributes.POI_ICON, string.Empty},
                {FeatureAttributes.POI_ICON_COLOR, "black"},
                {FeatureAttributes.ID, "id"},
                {FeatureAttributes.SEARCH_LANGUAGE, Languages.ENGLISH}
            }
        );
        featureInPlace.SetLocation(featureLocation);
        var featuresInsidePlace = new List<IFeature> { featureInPlace };
        _searchRepository.SearchPlaces(searchTerm, Languages.ENGLISH).Returns(featuresInsidePlace);

        var results = _controller.GetSearchResults(searchTerm, Languages.ENGLISH).Result.ToList();

        Assert.IsNotNull(results);
        Assert.AreEqual(featuresInsidePlace.Count, results.Count);
        Assert.IsFalse(results.First().DisplayName.Contains(place));
    }

    [TestMethod]
    public void GetSearchResults_ContainerHasNoName_ShouldNotIAddItToDisplayName()
    {
        const string place = "place";
        const string searchTerm = "searchTerm";
        var featureLocation = new Coordinate(0.5, 0.5);
        var featureInPlace = new Feature(new Point(featureLocation), new AttributesTable
        {
            {FeatureAttributes.NAME, "name"},
            {FeatureAttributes.POI_CATEGORY, Categories.HISTORIC},
            {FeatureAttributes.POI_SOURCE, Sources.OSM},
            {FeatureAttributes.POI_ICON, string.Empty},
            {FeatureAttributes.POI_ICON_COLOR, "black"},
            {FeatureAttributes.ID, "id"},
            {FeatureAttributes.SEARCH_LANGUAGE, Languages.ENGLISH}
        });
        featureInPlace.SetLocation(featureLocation);
        _searchRepository.Search(searchTerm, Languages.ENGLISH).Returns([featureInPlace]);
        _searchRepository.GetContainerName(Arg.Any<Coordinate[]>(), Arg.Any<string>()).Returns(place);

        var results = _controller.GetSearchResults(searchTerm, Languages.ENGLISH).Result;

        Assert.IsNotNull(results);
        Assert.IsTrue(results.First().DisplayName.Contains(place));
    }

    [TestMethod]
    public void GetSearchResults_WithMapCenterAndPrefix_ShouldForwardThemToTheRepository()
    {
        var searchTerm = "Bear Lake";
        _searchRepository.Search(searchTerm, Languages.ENGLISH,
            Arg.Any<double?>(), Arg.Any<double?>(), Arg.Any<double>(), Arg.Any<bool>())
            .Returns(new List<IFeature>());

        _controller.GetSearchResults(searchTerm, Languages.ENGLISH,
            lat: 40.3120, lng: -105.6457, zoom: 12, prefix: true).Wait();

        // The controller must pass the map center / zoom / prefix straight through, so that proximity
        // ranking and autocomplete behaviour actually take effect.
        _searchRepository.Received(1).Search(searchTerm, Languages.ENGLISH, 40.3120, -105.6457, 12, true);
    }

    [TestMethod]
    public void GetSearchResults_WithoutMapCenter_ShouldForwardDefaults()
    {
        var searchTerm = "Pikes Peak";
        _searchRepository.Search(searchTerm, Languages.ENGLISH,
            Arg.Any<double?>(), Arg.Any<double?>(), Arg.Any<double>(), Arg.Any<bool>())
            .Returns(new List<IFeature>());

        _controller.GetSearchResults(searchTerm, Languages.ENGLISH).Wait();

        // No center supplied -> nulls and defaults, so the gateway falls back to today's behaviour.
        _searchRepository.Received(1).Search(searchTerm, Languages.ENGLISH, null, null, 0, false);
    }

    private static IFeature DebugFeature(string container = null)
    {
        var loc = new Coordinate(0, 0);
        var feature = new Feature(new Point(loc), new AttributesTable
        {
            {FeatureAttributes.NAME, "Humphreys Peak"},
            {FeatureAttributes.POI_CATEGORY, Categories.HISTORIC},
            {FeatureAttributes.POI_SOURCE, Sources.OSM},
            {FeatureAttributes.POI_ICON, string.Empty},
            {FeatureAttributes.POI_ICON_COLOR, "black"},
            {FeatureAttributes.ID, "node_123"},
            {FeatureAttributes.SEARCH_LANGUAGE, Languages.ENGLISH},
            // DEBUG_SEARCH attributes the gateway sets only when its own flag is on:
            {FeatureAttributes.FEATURE_CLASS, "peak"},
            {FeatureAttributes.PROMINENCE, 0.73f},
            {FeatureAttributes.SCORE, 0.7517},
            {FeatureAttributes.BM25, 211.842},
            {FeatureAttributes.EXPLAIN, new { value = 0.7517, description = "script score" }},
            {"alt_name:en", "Humphrey's Peak; San Francisco Peak"}
        });
        feature.SetLocation(loc);
        return feature;
    }

    [TestMethod]
    public void GetSearchResults_DebugSearchOn_ShouldPopulateDebugObject()
    {
        var prev = SearchController.DebugSearch;
        try
        {
            SearchController.DebugSearch = true;
            var searchTerm = "Humphreys Peak";
            _searchRepository.Search(searchTerm, Languages.ENGLISH).Returns([DebugFeature()]);
            _searchRepository.GetContainerName(Arg.Any<Coordinate[]>(), Arg.Any<string>())
                .Returns("Coconino County");

            var result = _controller.GetSearchResults(searchTerm, Languages.ENGLISH).Result.First();

            Assert.IsNotNull(result.Debug, "DEBUG_SEARCH on must attach a debug object");
            Assert.AreEqual("peak", result.Debug.FeatureClass);
            Assert.AreEqual(0.73f, result.Debug.Prominence);
            Assert.AreEqual(Languages.ENGLISH, result.Debug.MatchedLanguage);
            Assert.AreEqual("Coconino County", result.Debug.Container);
            Assert.IsNotNull(result.Debug.AltNames);
            CollectionAssert.AreEquivalent(
                new[] { "Humphrey's Peak", "San Francisco Peak" },
                result.Debug.AltNames["en"]);
            // score diagnostics
            Assert.AreEqual(0.7517, result.Debug.Score);
            Assert.AreEqual(211.842, result.Debug.Bm25);
            Assert.IsNotNull(result.Debug.ScoreBreakdown);
            Assert.AreEqual(211.842 / 212.842, result.Debug.ScoreBreakdown["text_norm"], 1e-9);
            Assert.AreEqual(0.73f, result.Debug.ScoreBreakdown["prom_input"], 1e-6);
            Assert.IsNotNull(result.Debug.Explain);
        }
        finally
        {
            SearchController.DebugSearch = prev;
        }
    }

    [TestMethod]
    public void GetSearchResults_DebugSearchOff_ShouldNotAttachDebug()
    {
        var prev = SearchController.DebugSearch;
        try
        {
            // Production contract: with the flag off, the response carries NO debug object even if the
            // feature happens to hold the debug attributes — they must never leak to clients.
            SearchController.DebugSearch = false;
            var searchTerm = "Humphreys Peak";
            _searchRepository.Search(searchTerm, Languages.ENGLISH).Returns([DebugFeature()]);

            var result = _controller.GetSearchResults(searchTerm, Languages.ENGLISH).Result.First();

            Assert.IsNull(result.Debug, "DEBUG_SEARCH off must keep the production response debug-free");
        }
        finally
        {
            SearchController.DebugSearch = prev;
        }
    }
}