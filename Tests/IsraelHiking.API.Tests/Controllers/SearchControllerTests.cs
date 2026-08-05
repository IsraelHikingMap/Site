using IsraelHiking.API.Controllers;
using IsraelHiking.Common;
using IsraelHiking.Common.Poi;
using IsraelHiking.DataAccessInterfaces.Repositories;
using Microsoft.VisualStudio.TestTools.UnitTesting;
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

    private static List<SearchResultsPointOfInterest> Results(params string[] ids) =>
        ids.Select(id => new SearchResultsPointOfInterest { Id = id }).ToList();

    [TestMethod]
    public void GetSearchResults_LoneQuoteTerm_ShouldSearchInsteadOfExactMatch()
    {
        _searchRepository.Search(Arg.Any<string>(), Languages.ENGLISH).Returns(Results());

        var quoteResults = _controller.GetSearchResults("\"", Languages.ENGLISH).Result;
        var gershayimResults = _controller.GetSearchResults("״", Languages.ENGLISH).Result;

        Assert.AreEqual(0, quoteResults.Count());
        Assert.AreEqual(0, gershayimResults.Count());
        _searchRepository.DidNotReceive().SearchExact(Arg.Any<string>(), Arg.Any<string>());
    }

    [TestMethod]
    public void GetSearchResults_QuotedTerm_ShouldGetExactMatch()
    {
        _searchRepository.SearchExact("שלום", Languages.HEBREW).Returns(Results("1"));

        var results = _controller.GetSearchResults("״שלום״", Languages.HEBREW).Result;

        Assert.AreEqual(1, results.Count());
        _searchRepository.Received(1).SearchExact("שלום", Languages.HEBREW);
    }

    [TestMethod]
    public void GetSearchResults_RegularTerm_ShouldReturnSearchResults()
    {
        _searchRepository.Search("searchTerm", Languages.ENGLISH).Returns(Results("1", "2"));

        var results = _controller.GetSearchResults("searchTerm", Languages.ENGLISH).Result;

        Assert.AreEqual(2, results.Count());
    }

    [TestMethod]
    public void GetSearchResults_PlaceTermWithResults_ShouldReturnThePlaceResults()
    {
        const string term = "searchTerm, place";
        _searchRepository.SearchPlaces(term, Languages.ENGLISH).Returns(Results("1"));

        var results = _controller.GetSearchResults(term, Languages.ENGLISH).Result;

        Assert.AreEqual(1, results.Count());
        _searchRepository.DidNotReceive().Search(Arg.Any<string>(), Arg.Any<string>(),
            Arg.Any<double?>(), Arg.Any<double?>(), Arg.Any<double?>(), Arg.Any<bool>());
    }

    [TestMethod]
    public void GetSearchResults_PlaceTermWithoutResults_ShouldFallBackToRegularSearch()
    {
        const string term = "searchTerm, place";
        _searchRepository.SearchPlaces(term, Languages.ENGLISH).Returns(Results());
        _searchRepository.Search("searchTerm", Languages.ENGLISH).Returns(Results("1"));

        var results = _controller.GetSearchResults(term, Languages.ENGLISH).Result;

        Assert.AreEqual(1, results.Count());
        _searchRepository.Received(1).Search("searchTerm", Languages.ENGLISH);
    }

    [TestMethod]
    public void GetSearchResults_WithMapCenterAndPrefix_ShouldForwardThemToSearch()
    {
        var term = "Bear Lake";
        _searchRepository.Search(term, Languages.ENGLISH,
            Arg.Any<double?>(), Arg.Any<double?>(), Arg.Any<double?>(), Arg.Any<bool>())
            .Returns(Results());

        _controller.GetSearchResults(term, Languages.ENGLISH,
            lat: 40.3120, lng: -105.6457, zoom: 12, prefix: true).Wait();

        _searchRepository.Received(1).Search(term, Languages.ENGLISH, 40.3120, -105.6457, 12, true);
    }

    [TestMethod]
    public void GetSearchResults_WithoutMapCenter_ShouldForwardDefaults()
    {
        var term = "Pikes Peak";
        _searchRepository.Search(term, Languages.ENGLISH,
            Arg.Any<double?>(), Arg.Any<double?>(), Arg.Any<double?>(), Arg.Any<bool>())
            .Returns(Results());

        _controller.GetSearchResults(term, Languages.ENGLISH).Wait();

        _searchRepository.Received(1).Search(term, Languages.ENGLISH, null, null, null, false);
    }
}
