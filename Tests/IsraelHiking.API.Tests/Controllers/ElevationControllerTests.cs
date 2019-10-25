using IsraelHiking.API.Controllers;
using IsraelHiking.Common;
using IsraelHiking.DataAccessInterfaces;
using Microsoft.VisualStudio.TestTools.UnitTesting;
using NSubstitute;
using System.Linq;

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
            elevationDataStorage.GetElevation(point1.ToCoordinate()).Returns(1);
            elevationDataStorage.GetElevation(point2.ToCoordinate()).Returns(2);
            _elevationController = new ElevationController(elevationDataStorage);

            var response = _elevationController.GetElevation($"{point1}|{point2}").Result.ToArray();

            Assert.AreEqual(1, response[0]);
            Assert.AreEqual(2, response[1]);
        }
    }
}
