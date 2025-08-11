using System.Net.Http;
using IsraelHiking.Common.Configuration;
using IsraelHiking.DataAccessInterfaces;
using Microsoft.Extensions.Options;
using Microsoft.VisualStudio.TestTools.UnitTesting;
using NSubstitute;

namespace IsraelHiking.DataAccess.Tests;

[TestClass]
public class ShareUrlsGatewayTests
{
    private IShareUrlGateway _gateway; 
    
    [TestInitialize]
    public void TestInitialize()
    {
        var options = Substitute.For<IOptions<ConfigurationData>>();
        options.Value.Returns(new ConfigurationData());
        var httpFactory = Substitute.For<IHttpClientFactory>();
        httpFactory.CreateClient().Returns(new HttpClient());
        _gateway = new ShareUrlGateway(httpFactory, options);
    }

    [TestMethod]
    [Ignore]
    public void GetShareUrlsAsync_GivenValidRequest_ReturnsResult()
    {
        var shareUrl = _gateway.GetUrlById("123").Result;
        Assert.IsNotNull(shareUrl);
    }
    
}