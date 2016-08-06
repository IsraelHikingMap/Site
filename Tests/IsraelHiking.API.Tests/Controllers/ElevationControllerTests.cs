using System;
using Microsoft.VisualStudio.TestTools.UnitTesting;
using IsraelHiking.API.Controllers;
using NSubstitute;
using IsraelHiking.DataAccessInterfaces;
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
            elevationDataStorage.GetElevation(31.8239, 35.0375).Returns(1);
            elevationDataStorage.GetElevation(31.8213, 35.0965).Returns(2);
            _elevationController = new ElevationController(elevationDataStorage);

            var response = _elevationController.GetElevation(new[] { "31.8239,35.0375", "31.8213,35.0965" }).Result.ToArray();

            Assert.AreEqual(1, response[0]);
            Assert.AreEqual(2, response[1]);
        }
    }
}
