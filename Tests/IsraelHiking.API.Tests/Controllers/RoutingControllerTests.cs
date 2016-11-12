using System.Linq;
using System.Threading.Tasks;
using System.Web.Http.Results;
using GeoAPI.Geometries;
using IsraelHiking.API.Controllers;
using IsraelHiking.Common;
using IsraelHiking.DataAccessInterfaces;
using Microsoft.VisualStudio.TestTools.UnitTesting;
using NetTopologySuite.Features;
using NetTopologySuite.Geometries;
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
            _controller = new RoutingController(_routingGateway, _elevationDataStorage);
        }

        [TestMethod]
        public void GetRouting_HikingBadFromPoint_ShouldReturnInvalidModelState()
        {
            var results = _controller.GetRouting("from", "1,1", RoutingType.HIKE).Result as InvalidModelStateResult;

            Assert.IsNotNull(results);
        }

        [TestMethod]
        public void GetRouting_BikeBadToPoint_ShouldReturnInvalidModelState()
        {
            var results = _controller.GetRouting("1,1", "to", RoutingType.BIKE).Result as InvalidModelStateResult;

            Assert.IsNotNull(results);
        }

        [TestMethod]
        public void GetRouting_None_ShouldReturnLineStringWithTwoPoints()
        {
            var results = _controller.GetRouting("1,1", "2,2", RoutingType.NONE).Result as OkNegotiatedContentResult<FeatureCollection>;
            var content = results.Content;
            
            Assert.AreEqual(1, content.Features.Count);
            var lineString = content.Features.First().Geometry as LineString;
            Assert.IsNotNull(lineString);
            var points = lineString.Coordinates.OfType<Coordinate>();
            Assert.AreEqual(1, points.First().X);
            Assert.AreEqual(1, points.First().Y);
            Assert.AreEqual(2, points.Last().X);
            Assert.AreEqual(2, points.Last().Y);
        }

        [TestMethod]
        public void GetRouting_Car_ShouldReturnLineStringFromGateway()
        {
            _routingGateway.GetRouting(Arg.Any<RoutingGatewayRequest>())
                .Returns(Task.FromResult(new LineString(new []
                {
                    new Coordinate(1,1),
                    new Coordinate(1.5,1.5),
                    new Coordinate(2,2)
                })));

            var results = _controller.GetRouting("1,1", "2,2", RoutingType.FOUR_WHEEL_DRIVE).Result as OkNegotiatedContentResult<FeatureCollection>;
            var content = results.Content;

            Assert.AreEqual(1, content.Features.Count);
            var lineString = content.Features.First().Geometry as LineString;
            Assert.IsNotNull(lineString);
            var points = lineString.Coordinates.OfType<Coordinate>();
            Assert.AreEqual(3, points.Count());
            Assert.AreEqual(1, points.First().X);
            Assert.AreEqual(1, points.First().Y);
            Assert.AreEqual(2, points.Last().X);
            Assert.AreEqual(2, points.Last().Y);

        }
    }
}
