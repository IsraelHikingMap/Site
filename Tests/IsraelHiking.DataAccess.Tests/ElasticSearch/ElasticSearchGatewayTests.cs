using GeoAPI.Geometries;
using Microsoft.VisualStudio.TestTools.UnitTesting;

namespace IsraelHiking.DataAccess.Tests.ElasticSearch
{
    [TestClass]
    public class ElasticSearchGatewayTests
    {
        [TestMethod]
        [Ignore]
        public void Search_ShouldReturnResults()
        {
            var gateway = new ElasticSearchGateway(new TraceLogger());
            gateway.Initialize();
            var results = gateway.Search("מנות", "name").Result;
            Assert.AreEqual(10, results.Count);
        }

        [TestMethod]
        [Ignore]
        public void GetHighways_ShouldReturnResults()
        {
            var gateway = new ElasticSearchGateway(new TraceLogger());
            gateway.Initialize();
            var northEast = new Coordinate(35.0516, 31.7553);
            var southWest = new Coordinate(35.0251, 31.7467);
            var results = gateway.GetHighways(northEast, southWest).Result;
            Assert.AreEqual(36, results.Count);
        }

        [TestMethod]
        public void SetIndex_ShouldReturnResults()
        {
            var gateway = new ElasticSearchGateway(new TraceLogger());
            gateway.Initialize();
        }
    }
}

