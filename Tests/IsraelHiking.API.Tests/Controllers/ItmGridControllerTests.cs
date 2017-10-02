using GeoAPI.CoordinateSystems.Transformations;
using GeoAPI.Geometries;
using IsraelHiking.API.Controllers;
using IsraelHiking.API.Executors;
using Microsoft.VisualStudio.TestTools.UnitTesting;
using NSubstitute;

namespace IsraelHiking.API.Tests.Controllers
{
    [TestClass]
    public class ItmGridControllerTests
    {
        private ItmGridController _itmGridController;

        [TestMethod]
        public void GetItmCoordinates_ShouldConvertToNorthEast()
        {
            var northEast = new Coordinate { Y = 3, X = 4 };
            _itmGridController = new ItmGridController(new ItmWgs84MathTransfromFactory());

            var response = _itmGridController.GetItmCoordinates(1, 2);

            Assert.AreEqual(northEast.X, response.East);
            Assert.AreEqual(northEast.Y, response.North);
        }
    }
}
