using GeoAPI.Geometries;
using Microsoft.VisualStudio.TestTools.UnitTesting;

namespace IsraelHiking.DataAccess.Tests
{
    [TestClass]
    public class WikipediaGatewayTests
    {
        [TestMethod]
        [Ignore]
        public void GetWikiPageById()
        {
            var wikiGateway = new WikipediaGateway(new TraceLogger());
            wikiGateway.Initialize().Wait();
            var results = wikiGateway.GetById("he_104020").Result;
            Assert.IsNotNull(results);
        }

        [TestMethod]
        [Ignore]
        public void GetWikiPageByLocation()
        {
            var wikiGateway = new WikipediaGateway(new TraceLogger());
            wikiGateway.Initialize().Wait();
            var results = wikiGateway.GetByLocation(new Coordinate(35.12, 31.773), "he").Result;
            Assert.IsTrue(results.Count > 0);
        }
    }
}
