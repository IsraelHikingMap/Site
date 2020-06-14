using Microsoft.VisualStudio.TestTools.UnitTesting;
using System;

namespace IsraelHiking.DataAccess.Tests
{
    [TestClass]
    public class INatureGatewayTests
    {
        [TestMethod]
        [Ignore]
        public void GetAllPages()
        {
            var wikiGateway = new INatureGateway(new TraceLogger());
            wikiGateway.Initialize().Wait();
            var results = wikiGateway.GetAll().Result;
            Assert.IsTrue(results.Count > 0);
        }

        [TestMethod]
        [Ignore]
        public void GetUpdates()
        {
            var wikiGateway = new INatureGateway(new TraceLogger());
            wikiGateway.Initialize().Wait();
            var results = wikiGateway.GetUpdates(DateTime.Now.AddDays(-30)).Result;
            Assert.IsTrue(results.Count > 0);
        }
    }
}
