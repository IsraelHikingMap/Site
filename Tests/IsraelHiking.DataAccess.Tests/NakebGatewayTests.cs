using Microsoft.VisualStudio.TestTools.UnitTesting;

namespace IsraelHiking.DataAccess.Tests
{
    [TestClass]
    [Ignore]
    public class NakebGatewayTests
    {
        [TestMethod]
        public void TestGetAll()
        {
            var gateway = new NakebGateway();
            var results = gateway.GetAll().Result;
            Assert.IsTrue(results.Count > 0);
        }
    }
}
