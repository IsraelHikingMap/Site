using Microsoft.VisualStudio.TestTools.UnitTesting;
using IsraelHiking.DataAccessInterfaces;
using NSubstitute;

namespace IsraelHiking.DataAccess.Tests
{
    [TestClass]
    public class RemoteFileFetcherGatewayTests
    {
        [TestMethod]
        public void TestGateway_JeepologAttachmentGpx()
        {
            RemoteFileFetcherGateway gateway = new RemoteFileFetcherGateway(Substitute.For<ILogger>());
            var response = gateway.GetFileContent("http://www.jeepolog.com/forums/attachment.php?attachmentid=103471").Result;

            Assert.AreEqual("yehuda-2015.GPX", response.FileName);
        }

        [TestMethod]
        public void TestGateway_JeeptripTwl()
        {
            RemoteFileFetcherGateway gateway = new RemoteFileFetcherGateway(Substitute.For<ILogger>());
            var response = gateway.GetFileContent("http://jeeptrip.co.il/routes/pd6bccre.twl").Result;

            Assert.AreEqual("pd6bccre.twl", response.FileName);
        }
    }
}
