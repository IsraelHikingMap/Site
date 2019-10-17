using Microsoft.VisualStudio.TestTools.UnitTesting;
using NetTopologySuite.Geometries;

namespace IsraelHiking.DataAccess.Tests
{
    [TestClass]
    public class WikipediaGatewayTests
    {
        private WikipediaGateway _gateway;

        [TestInitialize]
        public void TestInitialize()
        {
            _gateway = new WikipediaGateway(new TraceLogger());
        }

        [TestMethod]
        [Ignore]
        public void GetWikiPageById()
        {

            _gateway.Initialize().Wait();
            var results = _gateway.GetById("he_104020").Result;
            Assert.IsNotNull(results);
        }

        [TestMethod]
        [Ignore]
        public void GetWikiPageByBoundingBox()
        {
            _gateway.Initialize().Wait();
            var delta = 0.15;
            var results = _gateway.GetByBoundingBox(new Coordinate(35, 32), new Coordinate(35 + delta, 32 + delta), "he").Result;
            Assert.IsTrue(results.Count > 0);
        }

        [TestMethod]
        [Ignore]
        public void GetWikiPageByTitle()
        {
            _gateway.Initialize().Wait();
            var results = _gateway.GetByPageTitle("aaaaaaaaa", "he").Result;
            Assert.IsNull(results);
        }
    }
}
