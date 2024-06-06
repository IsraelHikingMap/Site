using IsraelHiking.Common;
using Microsoft.VisualStudio.TestTools.UnitTesting;
using NetTopologySuite.Geometries;
using System.Linq;
using System.Net.Http;
using NSubstitute;

namespace IsraelHiking.DataAccess.Tests
{
    [TestClass]
    public class WikidataGatewayTests
    {
        private WikidataGateway _gateway;

        [TestInitialize]
        public void TestInitialize()
        {
            var factory = Substitute.For<IHttpClientFactory>();
            factory.CreateClient().Returns(new HttpClient());
            _gateway = new WikidataGateway(factory, new TraceLogger());
        }

        [TestMethod]
        [Ignore]
        public void GetWikiPageByBoundingBox()
        {
            var delta = 0.01;
            var results = _gateway.GetByBoundingBox(new Coordinate(35.057, 32.596), new Coordinate(35.057 + delta, 32.596 + delta)).Result;
            Assert.IsTrue(results.Count > 0);
        }
    }
}
