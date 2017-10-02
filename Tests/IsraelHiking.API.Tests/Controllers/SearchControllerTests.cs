using System.Collections.Generic;
using IsraelHiking.API.Controllers;
using IsraelHiking.API.Executors;
using IsraelHiking.DataAccessInterfaces;
using Microsoft.VisualStudio.TestTools.UnitTesting;
using NetTopologySuite.Features;
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
            _controller = new SearchController(_elasticSearchGateway, new ItmWgs84MathTransfromFactory());
        }

        [TestMethod]
        public void GetSearchResults_ShouldPassRequestToGateway_NoResultsFound()
        {
            var list = new List<Feature>();

            _elasticSearchGateway.Search("searchTerm", "name:en").Returns(list);

            var results = _controller.GetSearchResults("searchTerm", "en").Result;

            Assert.IsNotNull(results);
            Assert.AreEqual(list.Count, results.Features.Count);
        }

        [TestMethod]
        public void GetSearchResultsForSingleNumber_ShouldFail()
        {
            var results = _controller.GetSearchResults("+32, 35").Result;
            Assert.IsNotNull(results);
        }

        
    }
}
