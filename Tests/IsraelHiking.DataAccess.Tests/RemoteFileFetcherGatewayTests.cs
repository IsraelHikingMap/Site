using System.Linq;
using Microsoft.VisualStudio.TestTools.UnitTesting;
using NSubstitute;
using IsraelHiking.DataAccessInterfaces;
using System.Net.Http;

namespace IsraelHiking.DataAccess.Tests;

[TestClass]
public class RemoteFileFetcherGatewayTests
{
    private IRemoteFileSizeFetcherGateway _gateway;

    [TestInitialize]
    public void TestInitialize()
    {
        var factory = Substitute.For<IHttpClientFactory>();
        factory.CreateClient().Returns(new HttpClient());
        _gateway = new RemoteFileFetcherGateway(factory, new TraceLogger());
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
    [Ignore]
    public void TestGateway_InvalidFile()
    {
        var response = _gateway.GetFileContent("https://israelhiking.osm.org.il/Hebrew/Tiles/11/1228/826.png").Result;

        Assert.IsFalse(response.Content.Any());
    }

    [TestMethod]
    [Ignore]
    public void TestGateway_ImageFile()
    {
        var response = _gateway.GetFileContent("https://upload.wikimedia.org/wikipedia/commons/2/2a/Israel_Hiking_Map_%D7%97%D7%95%D7%A8%D7%91%D7%AA_%D7%9C%D7%95%D7%96%D7%94.jpeg").Result;

        Assert.IsFalse(response.Content.Any());
    }
        
    [TestMethod]
    [Ignore]
    public void TestGateway_ImageFileSize()
    {
        var response = _gateway.GetFileSize("https://upload.wikimedia.org/wikipedia/commons/d/d5/Khan_al-Ahmar_school_building%2C_2015.jpg").Result;

        Assert.AreNotEqual(0, response);
    }
}