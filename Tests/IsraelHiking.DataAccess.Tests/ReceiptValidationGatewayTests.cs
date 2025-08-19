using IsraelHiking.Common.Configuration;
using IsraelHiking.DataAccessInterfaces;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using Microsoft.VisualStudio.TestTools.UnitTesting;
using NSubstitute;
using System.Net.Http;

namespace IsraelHiking.DataAccess.Tests;

[TestClass]
public class ReceiptValidationGatewayTests
{
    private IReceiptValidationGateway _gateway;

    [TestInitialize]
    public void TestInitialize()
    {
        var factory = Substitute.For<IHttpClientFactory>();
        factory.CreateClient().Returns(new HttpClient());
        var options = Substitute.For<IOptions<NonPublicConfigurationData>>();
        options.Value.Returns(new NonPublicConfigurationData
        {
            FoveaApiKey = "fill-here",
            RevenueCatApiKey = "fill-here"
        });
        _gateway = new ReceiptValidationGateway(factory, options, Substitute.For<ILogger>());
    }

    [TestMethod]
    [Ignore]
    public void IsEntitled_ShouldReturnTrue()
    {
        Assert.IsTrue(_gateway.IsEntitled("user-id").Result);
    }
}