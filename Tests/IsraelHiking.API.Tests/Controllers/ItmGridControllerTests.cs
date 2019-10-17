using IsraelHiking.API.Controllers;
using IsraelHiking.API.Executors;
using Microsoft.VisualStudio.TestTools.UnitTesting;
using NetTopologySuite.Geometries;
using NSubstitute;
using ProjNet.CoordinateSystems.Transformations;

namespace IsraelHiking.API.Tests.Controllers
{
    [TestClass]
    public class ItmGridControllerTests
    {
        private ItmGridController _itmGridController;

        [TestMethod]
        [Ignore]
        // HM TODO: bring this back somehow
        public void GetItmCoordinates_ShouldConvertToNorthEast()
        {
            var northEast = new Coordinate { Y = 3, X = 4 };
            var converter = Substitute.For<MathTransform>();
            var factory = Substitute.For<IItmWgs84MathTransfromFactory>();
            factory.CreateInverse().Returns(converter);
            converter.Transform(Arg.Compat.Any<double>(), Arg.Compat.Any<double>()).Returns((northEast.X, northEast.Y));
            _itmGridController = new ItmGridController(factory);

            var response = _itmGridController.GetItmCoordinates(1, 2);

            Assert.AreEqual(northEast.X, response.East);
            Assert.AreEqual(northEast.Y, response.North);
        }
    }
}
