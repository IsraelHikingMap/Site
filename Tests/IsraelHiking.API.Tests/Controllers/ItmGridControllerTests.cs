using IsraelHiking.API.Controllers;
using IsraelTransverseMercator;
using Microsoft.VisualStudio.TestTools.UnitTesting;
using NSubstitute;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace IsraelHiking.API.Tests.Controllers
{
    [TestClass]
    public class ItmGridControllerTests
    {
        private ItmGridController _itmGridController;

        [TestMethod]
        public void GetItmCoordinates_ShouldConvertToNorthEast()
        {
            var northEast = new NorthEast { North = 3, East = 4 };
            var converter = Substitute.For<ICoordinatesConverter>();
            converter.Wgs84ToItm(Arg.Any<LatLon>()).Returns(northEast);
            _itmGridController = new ItmGridController(converter);

            var response = _itmGridController.GetItmCoordinates(1, 2);

            Assert.AreEqual(northEast.North, response.North);
            Assert.AreEqual(northEast.East, response.East);
        }
    }
}
