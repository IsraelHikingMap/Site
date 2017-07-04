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
using IsraelTransverseMercator;

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
            _controller = new SearchController(_elasticSearchGateway, _dataContainerConverterService, elevationDataStorage, new ItmWgs84MathTransfrom(false));
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

        [TestMethod]
        public void GetSearchResultsForSimpleLatLonCoordinates_ShouldReturnRelevantObject()
        {
            var results = _controller.GetSearchResults("  -11°  , +12.2 ").Result;

            Assert.IsNotNull(results);
            Assert.AreEqual(1, results.Features.Count);
        }

        [TestMethod]
        public void GetSearchResultsForNorthEastLatLonCoordinates_ShouldReturnRelevantObject()
        {
            var results = _controller.GetSearchResults("  11°N 12.2 E ").Result;

            Assert.IsNotNull(results);
            Assert.AreEqual(1, results.Features.Count);
        }

        [TestMethod]
        public void GetSearchResultsForSouthWestLatLonCoordinates_ShouldReturnRelevantObject()
        {
            var results = _controller.GetSearchResults("  11°6'S / 12 12 W ").Result;

            Assert.IsNotNull(results);
            Assert.AreEqual(1, results.Features.Count);
        }

        [TestMethod]
        public void GetSearchResultsForWestNorthWithMinutesLatLonCoordinates_ShouldReturnRelevantObject()
        {
            var results = _controller.GetSearchResults("  11°6'36\"W ,12 12\u2032 4.5\u2033 N ").Result;

            Assert.IsNotNull(results);
            Assert.AreEqual(1, results.Features.Count);
        }

        [TestMethod]
        public void GetSearchResultsForLatLonWithSlashCoordinates_ShouldReturnRelevantObject()
        {
            var results = _controller.GetSearchResults("-90.000/+180 ").Result;

            Assert.IsNotNull(results);
            Assert.AreEqual(1, results.Features.Count);
        }

        [TestMethod]
        public void GetSearchResultsForDecimalLatLonCoordinates_ShouldFail()
        {
            var faulted = _controller.GetSearchResults("+90.0001,-180 ").IsFaulted;
            Assert.IsTrue(faulted);
        }

        [TestMethod]
        public void GetSearchResultsForDecimalWithSpaceLatLonCoordinates_ShouldFail()
        {
            var faulted = _controller.GetSearchResults("-90.0001 +180 ").IsFaulted;
            Assert.IsTrue(faulted);
        }

        [TestMethod]
        public void GetSearchResultsForDecimalOnLonLatLonCoordinates_ShouldFail()
        {
            var faulted = _controller.GetSearchResults("+90 -180.0001 ").IsFaulted;
            Assert.IsTrue(faulted);
        }

        [TestMethod]
        public void GetSearchResultsForDecimalWithPlusMinusLatLonCoordinates_ShouldFail()
        {
            var faulted = _controller.GetSearchResults("-90 +180.0001 ").IsFaulted;
            Assert.IsTrue(faulted);
        }

        [TestMethod]
        public void GetSearchResultsForSingleNumber_ShouldFail()
        {
            var faulted = _controller.GetSearchResults("+32").IsFaulted;
            Assert.IsTrue(faulted);
        }

        [TestMethod]
        public void GetSearchResultsForItmCoordinates_ShouldReturnRelevantObject()
        {
            // delimiters
            var results = _controller.GetSearchResults("200000 600000").Result;
            Assert.IsNotNull(results);
            Assert.AreEqual(1, results.Features.Count);
        }

        [TestMethod]
        public void GetSearchResultsForItmCoordinatesWithComa_ShouldReturnRelevantObject()
        {
            var results = _controller.GetSearchResults("200000,600000").Result;
            Assert.IsNotNull(results);
            Assert.AreEqual(1, results.Features.Count);
        }

        [TestMethod]
        public void GetSearchResultsForItmCoordinatesWithSlash_ShouldReturnRelevantObject()
        {
            var results = _controller.GetSearchResults("200000/600000").Result;
            Assert.IsNotNull(results);
            Assert.AreEqual(1, results.Features.Count);
        }

        [TestMethod]
        public void GetSearchResultsForItmCoordinatesWithoutSpace_ShouldReturnRelevantObject()
        {
            var results = _controller.GetSearchResults("200000600000").Result;
            Assert.IsNotNull(results);
            Assert.AreEqual(1, results.Features.Count);
        }

        [TestMethod]
        public void GetSearchResultsForIcsCoordinates_ShouldReturnRelevantObject()
        {
            var results = _controller.GetSearchResults("120000 900000").Result;
            Assert.IsNotNull(results);
            Assert.AreEqual(1, results.Features.Count);
        }

        [TestMethod]
        public void GetSearchResultsForIcsCoordinatesWithComa_ShouldReturnRelevantObject()
        {
            var results = _controller.GetSearchResults("120000,200000").Result;
            Assert.IsNotNull(results);
            Assert.AreEqual(1, results.Features.Count);
        }

        [TestMethod]
        public void GetSearchResultsForIcsCoordinatesWithLargeNumber_ShouldReturnRelevantObject()
        {
            var results = _controller.GetSearchResults("120000 1349999").Result;
            Assert.IsNotNull(results);
            Assert.AreEqual(1, results.Features.Count);
        }

        [TestMethod]
        public void GetSearchResultsForIcsCoordinatesWithoutSpace_ShouldReturnRelevantObject()
        {
            var results = _controller.GetSearchResults("1200001100000").Result;
            Assert.IsNotNull(results);
            Assert.AreEqual(1, results.Features.Count);
        }

        [TestMethod]
        public void GetSearchResultsForIcsCoordinatesOnEastingBundries_ShouldReturnRelevantObject()
        {
            // easting baundaries
            var results = _controller.GetSearchResults("100000 600000").Result;
            Assert.IsNotNull(results);
            Assert.AreEqual(1, results.Features.Count);

            results = _controller.GetSearchResults("300000 600000").Result;
            Assert.IsNotNull(results);
            Assert.AreEqual(1, results.Features.Count);
        }

        [TestMethod]
        public void GetSearchResultsForOutOfBoundsItmCoordinates_ShouldFail()
        {
            var faulted = _controller.GetSearchResults("300001,600000").IsFaulted;
            Assert.AreEqual(faulted, true);

             faulted = _controller.GetSearchResults("99999,600000").IsFaulted;
            Assert.AreEqual(faulted, true);

            faulted = _controller.GetSearchResults("300001,100000").IsFaulted;
            Assert.AreEqual(faulted, true);

            faulted = _controller.GetSearchResults("200000,1350000").IsFaulted;
            Assert.AreEqual(faulted, true);
        }
    }
}
