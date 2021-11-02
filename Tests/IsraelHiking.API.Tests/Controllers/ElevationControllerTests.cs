using IsraelHiking.API.Controllers;
using IsraelHiking.DataAccessInterfaces;
using Microsoft.VisualStudio.TestTools.UnitTesting;
using NSubstitute;
using System.Linq;
using NetTopologySuite.Geometries;

namespace IsraelHiking.API.Tests.Controllers
{
    [TestClass]
    public class ElevationControllerTests
    {
        private ElevationController _elevationController;

        [TestMethod]
        public void GetElevation_TwoPoints_ShouldReturnThem()
        {
            var elevationGateway = Substitute.For<IElevationGateway>();
            var point1 = "31.8239,35.0375";
            var point2 = "31.8213,35.0965";
            elevationGateway.GetElevation(Arg.Any<Coordinate[]>()).Returns(new double[]{ 1, 2});
            _elevationController = new ElevationController(elevationGateway);

            var response = _elevationController.GetElevation($"{point1}|{point2}").Result.ToArray();

            Assert.AreEqual(1, response[0]);
            Assert.AreEqual(2, response[1]);
        }
    }
}
