using System.IO;
using System.Net.Http;
using Microsoft.VisualStudio.TestTools.UnitTesting;
using NSubstitute;

namespace IsraelHiking.DataAccess.Tests;

[TestClass]
public class ImgurGatewayTests
{
    [TestMethod]
    [Ignore]
    public void TestUploadImage()
    {
        var factory = Substitute.For<IHttpClientFactory>();
        factory.CreateClient().Returns(new HttpClient());
        var gateway = new ImgurGateway(factory, null, null);
        using (var stream = File.OpenRead(@"C:\Users\harel\Desktop\Mapping\IHM_screenshot_bike.jpg"))
        {
            var result = gateway.UploadImage(stream).Result;
            Assert.IsNotNull(result);
        }       
    }
}