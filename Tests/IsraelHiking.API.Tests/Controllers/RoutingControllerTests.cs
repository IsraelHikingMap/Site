using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using System.Web.Http.Results;
using GeoJSON.Net.Feature;
using GeoJSON.Net.Geometry;
using IsraelHiking.API.Controllers;
using IsraelHiking.Common;
using IsraelHiking.DataAccessInterfaces;
using Microsoft.VisualStudio.TestTools.UnitTesting;
using NSubstitute;

namespace IsraelHiking.API.Tests.Controllers
{
    [TestClass]
    public class RoutingControllerTests
    {
        private RoutingController _controller;
        private IRoutingGateway _routingGateway;
        private IElevationDataStorage _elevationDataStorage;

        [TestInitialize]
        public void TestInitialize()
        {
            _routingGateway = Substitute.For<IRoutingGateway>();
            _elevationDataStorage = Substitute.For<IElevationDataStorage>();
            _controller = new RoutingController(_routingGateway, _elevationDataStorage, Substitute.For<ILogger>());
        }

        [TestMethod]
        public void GetRouting_HikingBadFromPoint_ShouldReturnInvalidModelState()
        {
            var results = _controller.GetRouting("from", "1,1", "Hike").Result as InvalidModelStateResult;

            Assert.IsNotNull(results);
        }

        [TestMethod]
        public void GetRouting_BikeBadToPoint_ShouldReturnInvalidModelState()
        {
            var results = _controller.GetRouting("1,1", "to", "Bike").Result as InvalidModelStateResult;

            Assert.IsNotNull(results);
        }

        [TestMethod]
        public void GetRouting_None_ShouldReturnLineStringWithTwoPoints()
        {
            var results = _controller.GetRouting("1,1", "2,2", "None").Result as OkNegotiatedContentResult<FeatureCollection>;
            var content = results.Content;
            
            Assert.AreEqual(1, content.Features.Count);
            var lineString = content.Features.First().Geometry as LineString;
            Assert.IsNotNull(lineString);
            var points = lineString.Coordinates.OfType<GeographicPosition>();
            Assert.AreEqual(1, points.First().Latitude);
            Assert.AreEqual(1, points.First().Latitude);
            Assert.AreEqual(2, points.Last().Latitude);
            Assert.AreEqual(2, points.Last().Latitude);
        }

        [TestMethod]
        public void GetRouting_Car_ShouldReturnLineStringFromGateway()
        {
            _routingGateway.GetRouting(Arg.Any<RoutingGatewayRequest>())
                .Returns(Task.FromResult(new LineString(new List<GeographicPosition>()
                {
                    new GeographicPosition(1,1),
                    new GeographicPosition(1.5,1.5),
                    new GeographicPosition(2,2)
                })));

            var results = _controller.GetRouting("1,1", "2,2", "4WD").Result as OkNegotiatedContentResult<FeatureCollection>;
            var content = results.Content;

            Assert.AreEqual(1, content.Features.Count);
            var lineString = content.Features.First().Geometry as LineString;
            Assert.IsNotNull(lineString);
            var points = lineString.Coordinates.OfType<GeographicPosition>();
            Assert.AreEqual(3, points.Count());
            Assert.AreEqual(1, points.First().Latitude);
            Assert.AreEqual(1, points.First().Latitude);
            Assert.AreEqual(2, points.Last().Latitude);
            Assert.AreEqual(2, points.Last().Latitude);

        }
    }
}
