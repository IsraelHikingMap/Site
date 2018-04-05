using System.Collections.Generic;
using System.Linq;
using IsraelHiking.API.Controllers;
using IsraelHiking.API.Executors;
using IsraelHiking.Common;
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
            var searchTerm = "searchTerm";
            _elasticSearchGateway.Search(searchTerm, Languages.ENGLISH).Returns(list);

            var results = _controller.GetSearchResults(searchTerm, Languages.ENGLISH).Result;

            Assert.IsNotNull(results);
            Assert.AreEqual(list.Count, results.Count());
        }

        [TestMethod]
        public void GetSearchResultsForSingleNumber_ShouldFail()
        {
            var results = _controller.GetSearchResults("+32, 35", Languages.HEBREW).Result;
            Assert.IsNotNull(results);
        }

        
    }
}
