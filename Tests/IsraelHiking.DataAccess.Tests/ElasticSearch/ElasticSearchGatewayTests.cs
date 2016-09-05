using IsraelHiking.DataAccess.ElasticSearch;
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
            ElasticSearchGateway gateway = new ElasticSearchGateway(new TraceLogger());
            gateway.Initialize();
            var results = gateway.Search("מנות").Result;
            Assert.AreEqual(10, results.Count);
        }
    }
}
