using IsraelHiking.Common.Configuration;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using Microsoft.VisualStudio.TestTools.UnitTesting;
using NetTopologySuite.Geometries;
using NSubstitute;
using System.IO;

namespace IsraelHiking.DataAccess.Tests;

[TestClass]
public class WikimediaCommonGatewayTests
{
    private WikimediaCommonGateway _gateway;

    [TestInitialize]
    public void TestInitialize()
    {
        var options = new NonPublicConfigurationData
        {
            WikiMediaUserName = "WikiMediaUserName",
            WikiMediaPassword = "WikiMediaPassword"
        };
        var optionsContainer = Substitute.For<IOptions<NonPublicConfigurationData>>();
        var logger = Substitute.For<ILogger>();
        optionsContainer.Value.Returns(options);
        _gateway = new WikimediaCommonGateway(optionsContainer, logger);
    }

    [TestMethod]
    [Ignore]
    public void GetImageUrl()
    {
        try
        {
            _gateway.Initialize().Wait();
        }
        catch
        {
            // login will fail but we still want to proceed...
        }

        var results = _gateway.GetImageUrl("File:Israel_Hiking_Map_עין_מחוללים.jpeg").Result;

        Assert.IsNotNull(results);
    }

    [TestMethod]
    [Ignore]
    public void UploadImage()
    {
        _gateway.Initialize().Wait();

        var results = _gateway.UploadImage("file", "description", "me", new MemoryStream(),
            new Coordinate(0, 0)).Result;

        Assert.IsNotNull(results);
    }
}