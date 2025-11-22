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
        var list = new List<IFeature> {feature};
        var searchTerm = "searchTerm";
        _searchRepository.Search(searchTerm, Languages.ENGLISH).Returns(list);

        var results = _controller.GetSearchResults(searchTerm, Languages.ENGLISH).Result;

        Assert.IsNotNull(results);
        Assert.AreEqual(list.Count, results.Count());
        Assert.AreEqual(results.First().Title, "name-russian");
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
}