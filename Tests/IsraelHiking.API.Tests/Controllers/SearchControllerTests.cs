using System.Collections.Generic;
using GeoAPI.Geometries;
using IsraelHiking.API.Controllers;
using IsraelHiking.API.Services;
using IsraelHiking.Common;
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

            _elasticSearchGateway.Search("searchTerm", "name:en").Returns(list);

            var results = _controller.GetSearchResults("searchTerm", "en").Result;

            Assert.IsNotNull(results);
            Assert.AreEqual(list.Count, results.Features.Count);
        }

        [TestMethod]
        public void PostConvertSearchResults_JsonObject_ShouldConvertToDataContianer()
        {

            var feature = new Feature(new LineString(new[]
            {
                new Coordinate(1, 1),
                new Coordinate(2, 2)
            }), new AttributesTable());

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
                                    new RouteSegmentData {latlngs = new List<LatLng> {new LatLng()}}
                                }
                        }
                    }
                });


            var results = _controller.PostConvertSearchResults(feature).Result;

            Assert.AreEqual(1, results.routes.Count);
        }
    }
}
