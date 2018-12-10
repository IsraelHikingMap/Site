using System.Linq;
using Microsoft.VisualStudio.TestTools.UnitTesting;
using NSubstitute;
using Microsoft.Extensions.Logging;

namespace IsraelHiking.DataAccess.Tests
{
    [TestClass]
    public class RemoteFileFetcherGatewayTests
    {
        [TestMethod]
        [Ignore]
        public void TestGateway_JeepologAttachmentGpx()
        {
            RemoteFileFetcherGateway gateway = new RemoteFileFetcherGateway(Substitute.For<ILogger>());
            var response = gateway.GetFileContent("http://www.jeepolog.com/forums/attachment.php?attachmentid=103471").Result;

            Assert.AreEqual("yehuda-2015.GPX", response.FileName);
        }

        [TestMethod]
        [Ignore]
        public void TestGateway_JeeptripTwl()
        {
            RemoteFileFetcherGateway gateway = new RemoteFileFetcherGateway(Substitute.For<ILogger>());
            var response = gateway.GetFileContent("http://jeeptrip.co.il/routes/pd6bccre.twl").Result;

            Assert.AreEqual("pd6bccre.twl", response.FileName);
        }

        [TestMethod]
        public void TestGateway_InvalidFile()
        {
            var gateway = new RemoteFileFetcherGateway(Substitute.For<ILogger>());
            var response = gateway.GetFileContent("http://israelhiking.osm.org.il/Hebrew/Tiles/11/1228/826.png").Result;

            Assert.IsFalse(response.Content.Any());
        }
    }
}
