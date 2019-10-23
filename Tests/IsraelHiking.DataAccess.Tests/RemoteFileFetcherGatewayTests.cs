using System.Linq;
using Microsoft.VisualStudio.TestTools.UnitTesting;
using NSubstitute;
using Microsoft.Extensions.Logging;
using IsraelHiking.DataAccessInterfaces;
using System.Net.Http;

namespace IsraelHiking.DataAccess.Tests
{
    [TestClass]
    public class RemoteFileFetcherGatewayTests
    {
        private IRemoteFileFetcherGateway _gateway;

        [TestInitialize]
        public void TestInitialize()
        {
            var factory = Substitute.For<IHttpClientFactory>();
            factory.CreateClient().Returns(new HttpClient());
            _gateway = new RemoteFileFetcherGateway(factory, Substitute.For<ILogger>());
        }


        [TestMethod]
        [Ignore]
        public void TestGateway_JeepologAttachmentGpx()
        {
            var response = _gateway.GetFileContent("http://www.jeepolog.com/forums/attachment.php?attachmentid=103471").Result;

            Assert.AreEqual("yehuda-2015.GPX", response.FileName);
        }

        [TestMethod]
        [Ignore]
        public void TestGateway_JeeptripTwl()
        {
            var response = _gateway.GetFileContent("http://jeeptrip.co.il/routes/pd6bccre.twl").Result;

            Assert.AreEqual("pd6bccre.twl", response.FileName);
        }

        [TestMethod]
        public void TestGateway_InvalidFile()
        {
            var response = _gateway.GetFileContent("http://israelhiking.osm.org.il/Hebrew/Tiles/11/1228/826.png").Result;

            Assert.IsFalse(response.Content.Any());
        }
    }
}
