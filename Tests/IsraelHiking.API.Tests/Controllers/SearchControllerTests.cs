using System;
using System.Collections.Generic;
using System.Threading.Tasks;
using GeoJSON.Net.Feature;
using IsraelHiking.API.Controllers;
using IsraelHiking.DataAccessInterfaces;
using Microsoft.VisualStudio.TestTools.UnitTesting;
using NSubstitute;

namespace IsraelHiking.API.Tests.Controllers
{
    [TestClass]
    public class SearchControllerTests
    {
        private IElasticSearchGateway _elasticSearchGateway;
        private SearchController _controller;

        [TestInitialize]
        public void TestInitialize()
        {
            _elasticSearchGateway = Substitute.For<IElasticSearchGateway>();
            _controller = new SearchController(_elasticSearchGateway);
        }

        [TestMethod]
        public void GetSearchResults_ShouldPassRequestToGateway_NoResultsFound()
        {
            _elasticSearchGateway.Search("searchTerm", "en-us").Returns(Task.FromResult(new List<Feature>()));

            var results = _controller.GetSearchResults("searchTerm", "en-us").Result;

            Assert.IsNotNull(results);
            Assert.AreEqual(0, results.Features.Count);
        }
    }
}
