using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using GeoAPI.Geometries;
using IsraelHiking.API.Controllers;
using IsraelHiking.DataAccessInterfaces;
using Microsoft.VisualStudio.TestTools.UnitTesting;
using NetTopologySuite.Features;
using NetTopologySuite.Geometries;
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
            var list = new List<Feature>();

            _elasticSearchGateway.Search("searchTerm", "name:en").Returns(Task.FromResult(list));

            var results = _controller.GetSearchResults("searchTerm", "en").Result;

            Assert.IsNotNull(results);
            Assert.AreEqual(list.Count, results.Features.Count);
        }
    }
}
