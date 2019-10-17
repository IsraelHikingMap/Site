using Microsoft.VisualStudio.TestTools.UnitTesting;

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
    }
}
