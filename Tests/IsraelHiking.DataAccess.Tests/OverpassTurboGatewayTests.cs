using Microsoft.Extensions.Logging;
using Microsoft.VisualStudio.TestTools.UnitTesting;
using NSubstitute;
using System.Linq;
using System.Net.Http;

namespace IsraelHiking.DataAccess.Tests
{
    [TestClass]
    public class OverpassTurboGatewayTests
    {
        private OverpassTurboGateway _gateway;

        [TestInitialize]
        public void TestInitialize()
        {
            var factory = Substitute.For<IHttpClientFactory>();
            factory.CreateClient().Returns(new HttpClient());
            _gateway = new OverpassTurboGateway(factory, Substitute.For<ILogger>());
        }

        [TestMethod]
        [Ignore]
        public void GetWikipediaLinkedTitles()
        {
            var list = _gateway.GetWikipediaLinkedTitles().Result;
            var problem = list.Where(n => n.Contains("שמרת"));
            Assert.IsTrue(list.Count > 0);
        }

    }
}
