using Microsoft.VisualStudio.TestTools.UnitTesting;
using IsraelHiking.API.Controllers;
using NSubstitute;
using IsraelHiking.DataAccessInterfaces;
using System.Linq;
using GeoAPI.Geometries;
using IsraelHiking.Common;

namespace IsraelHiking.API.Tests.Controllers
{
    [TestClass]
    public class ElevationControllerTests
    {
        private ElevationController _elevationController;

        [TestMethod]
        public void GetElevation_TwoPoints_ShouldReturnThem()
        {
            var elevationDataStorage = Substitute.For<IElevationDataStorage>();
            var point1 = "31.8239,35.0375";
            var point2 = "31.8213,35.0965";
            elevationDataStorage.GetElevation(new Coordinate().FromLatLng(point1)).Returns(1);
            elevationDataStorage.GetElevation(new Coordinate().FromLatLng(point2)).Returns(2);
            _elevationController = new ElevationController(elevationDataStorage);

            var response = _elevationController.GetElevation($"{point1}|{point2}").Result.ToArray();

            Assert.AreEqual(1, response[0]);
            Assert.AreEqual(2, response[1]);
        }
    }
}
