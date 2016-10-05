using System.Collections.Generic;
using System.Threading.Tasks;
using IsraelHiking.API.Controllers;
using IsraelHiking.API.Services;
using IsraelHiking.Common;
using IsraelHiking.DataAccessInterfaces;
using Microsoft.VisualStudio.TestTools.UnitTesting;
using NetTopologySuite.Features;
using Newtonsoft.Json.Linq;
using NSubstitute;

namespace IsraelHiking.API.Tests.Controllers
{
    [TestClass]
    public class SearchControllerTests
    {
        private IElasticSearchGateway _elasticSearchGateway;
        IDataContainerConverterService _dataContainerConverterService;
        private SearchController _controller;

        [TestInitialize]
        public void TestInitialize()
        {
            _elasticSearchGateway = Substitute.For<IElasticSearchGateway>();
            var elevationDataStorage = Substitute.For<IElevationDataStorage>();
            
            _dataContainerConverterService = Substitute.For<IDataContainerConverterService>();
            _controller = new SearchController(_elasticSearchGateway, _dataContainerConverterService, elevationDataStorage);
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
        public void PostConvertSearchResults_JsonObject_ShouldConvertToDataContianer()
        {
            dynamic jsonObject = new JObject();
            jsonObject.type = "Feature";
            jsonObject.geometry = new JObject();
            jsonObject.geometry.type = "LineString";
            jsonObject.geometry.coordinates = new JArray(new JArray(1, 1), new JArray(2, 2));
            jsonObject.properties = new JObject();
            jsonObject.properties.name = "name";

            _dataContainerConverterService.ToDataContainer(Arg.Any<byte[]>(), Arg.Any<string>())
                .Returns(new DataContainer
                {
                    routes = new List<RouteData>
                    {
                        new RouteData
                        {
                            segments =
                                new List<RouteSegmentData>
                                {
                                    new RouteSegmentData {latlngzs = new List<LatLngZ> {new LatLngZ()}}
                                }
                        }
                    }
                });


            var results = _controller.PostConvertSearchResults(jsonObject).Result;

            Assert.AreEqual(1, results.routes.Count);
        }
    }
}
