using Microsoft.VisualStudio.TestTools.UnitTesting;
using NSubstitute;
using System.Net.Http;

namespace IsraelHiking.DataAccess.Tests
{
    [TestClass]
    [Ignore]
    public class NakebGatewayTests
    {
        [TestMethod]
        public void TestGetAll()
        {
            var factory = Substitute.For<IHttpClientFactory>();
            factory.CreateClient().Returns(new HttpClient());
            var gateway = new NakebGateway(factory);
            var results = gateway.GetAll().Result;
            Assert.IsTrue(results.Count > 0);
        }
    }
}
