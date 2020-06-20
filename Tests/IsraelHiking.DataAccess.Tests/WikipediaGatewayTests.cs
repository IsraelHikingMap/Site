using IsraelHiking.Common;
using Microsoft.VisualStudio.TestTools.UnitTesting;
using NetTopologySuite.Geometries;
using System.Linq;

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
        public void GetWikiPageByBoundingBox()
        {
            _gateway.Initialize().Wait();
            var delta = 0.15;
            var results = _gateway.GetByBoundingBox(new Coordinate(35, 32), new Coordinate(35 + delta, 32 + delta), "he").Result;
            Assert.IsTrue(results.Count > 0);
        }

        [TestMethod]
        [Ignore]
        public void GetWikiPageByBoundingBox_ShouldGetMoreThan500()
        {
            _gateway.Initialize().Wait();
            var delta = 0.15;

            var results = _gateway.GetByBoundingBox(new Coordinate(34.75, 32), new Coordinate(34.75 + delta, 32 + delta), "he").Result;
            Assert.IsTrue(results.Count > 500);
            Assert.IsTrue(results.Where(r => r.Attributes[FeatureAttributes.ID].ToString() == "he_8772").Any());
        }

        [TestMethod]
        [Ignore]
        public void GetWikiPagesByTitles_ShouldGetAllInfo()
        {
            _gateway.Initialize().Wait();

            var results = _gateway.GetByPagesTitles(new[] { "רמות מנשה (קיבוץ)" }, "he").Result;
            Assert.IsTrue(results.Count > 0);
        }
    }
}
