using System.Linq;
using Microsoft.Extensions.Logging;
using Microsoft.VisualStudio.TestTools.UnitTesting;
using NSubstitute;
using System.Net.Http;
using IsraelHiking.Common.Configuration;
using Microsoft.Extensions.Options;
using NetTopologySuite.Geometries;

namespace IsraelHiking.DataAccess.Tests;

[TestClass]
public class OverpassTurboGatewayTests
{
    private OverpassTurboGateway _gateway;

    [TestInitialize]
    public void TestInitialize()
    {
        var factory = Substitute.For<IHttpClientFactory>();
        factory.CreateClient().Returns(new HttpClient());
        var optionsProvides = Substitute.For<IOptions<ConfigurationData>>();
        optionsProvides.Value.Returns(new ConfigurationData());
        _gateway = new OverpassTurboGateway(factory, optionsProvides, Substitute.For<ILogger>());
    }
    
    
    [TestMethod]
    [Ignore]
    public void GetHighways()
    {
        var list = _gateway.GetHighways(new Coordinate(35.11, 32.11), new Coordinate(35.1,32.1)).Result;
        Assert.IsTrue(list.Count > 0);
        Assert.IsNotNull(list.First().Version);
    }
    
    [TestMethod]
    [Ignore]
    public void GetImages()
    {
        var list = _gateway.GetImagesUrls().Result;
        Assert.IsTrue(list.Count > 0);
    }

}