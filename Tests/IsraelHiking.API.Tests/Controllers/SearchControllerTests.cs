using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using GeoJSON.Net.Feature;
using GeoJSON.Net.Geometry;
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
            var list = new List<Feature>();

            _elasticSearchGateway.Search("searchTerm", "name:en").Returns(Task.FromResult(list));

            var results = _controller.GetSearchResults("searchTerm", "en").Result;

            Assert.IsNotNull(results);
            Assert.AreEqual(list.Count, results.Features.Count);
        }

        [TestMethod]
        public void GetSearchResults_ShouldFindContainingFeature_ResultsWithAddress()
        {
            var point = new Feature(new Point(new GeographicPosition(1, 1)));
            var line = new Feature(new LineString(new[] { new GeographicPosition(1, 1), new GeographicPosition(2, 2) }), new Dictionary<string, object> { {"name:en", "name:en" }});

            _elasticSearchGateway.Search("searchTerm", "name:en").Returns(Task.FromResult(new List<Feature> { point }));
            _elasticSearchGateway.GetContainingFeature(point).Returns(Task.FromResult(line));

            var results = _controller.GetSearchResults("searchTerm", "en").Result;

            Assert.IsNotNull(results);
            var feature = results.Features.FirstOrDefault();
            Assert.IsNotNull(feature);
            Assert.AreEqual(line.Properties["name:en"], feature.Properties["address"]);
        }
    }
}
