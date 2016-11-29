using IsraelHiking.Common;
using IsraelHiking.DataAccess.Osm;
using Microsoft.VisualStudio.TestTools.UnitTesting;

namespace IsraelHiking.DataAccess.Tests
{
    [TestClass]
    public class OverpassGatewayTests
    {
        [TestMethod]
        public void GetHighways()
        {
            var northEast = new LatLng {lat = 31.6331, lng = 34.9286};
            var southWest = new LatLng {lat = 31.6320, lng = 34.9266};
            var gateway = new OverpassGateway();
            var highways = gateway.GetHighways(northEast, southWest).Result;
            Assert.AreEqual(1, highways.Count);
        }
    }
}
