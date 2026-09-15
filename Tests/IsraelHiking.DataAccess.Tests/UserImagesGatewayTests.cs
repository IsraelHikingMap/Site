using IsraelHiking.Common.Configuration;
using IsraelHiking.DataAccessInterfaces;
using Microsoft.Extensions.Options;
using Microsoft.VisualStudio.TestTools.UnitTesting;
using NetTopologySuite.Geometries;
using NSubstitute;
using SkiaSharp;
using System;
using System.Net.Http;

namespace IsraelHiking.DataAccess.Tests;

[TestClass]
public class UserImagesGatewayTests
{
    private UserImagesGateway _gateway;
    private IOsmAccessTokenProvider _osmAccessTokenProvider;

    [TestInitialize]
    public void TestInitialize()
    {
        var factory = Substitute.For<IHttpClientFactory>();
        factory.CreateClient().Returns(_ => new HttpClient());
        var options = Substitute.For<IOptions<ConfigurationData>>();
        options.Value.Returns(new ConfigurationData());
        _osmAccessTokenProvider = Substitute.For<IOsmAccessTokenProvider>();
        _gateway = new UserImagesGateway(factory, _osmAccessTokenProvider, options, new TraceLogger());
    }

    [TestMethod]
    public void UploadImage_WithoutAnAuthenticatedUser_ShouldThrow()
    {
        _osmAccessTokenProvider.GetToken().Returns((string)null);

        Assert.ThrowsExactly<AggregateException>(() => _ = _gateway
            .UploadImage("test.jpg", "description", "me", new System.IO.MemoryStream(), new Coordinate(35.2137, 31.7683)).Result);
    }

    /// <remarks>
    /// Needs the user-images service of docker-compose to be running with TEST_MODE turned on, so that
    /// it accepts the token below instead of asking OSM about it.
    /// </remarks>
    [TestMethod]
    [Ignore("Runs against the user-images service of docker-compose")]
    public void UploadImage()
    {
        _osmAccessTokenProvider.GetToken().Returns("TEST_TOKEN");
        using var bitmap = new SKBitmap(1, 1);
        using var image = SKImage.FromBitmap(bitmap);
        using var data = image.Encode(SKEncodedImageFormat.Jpeg, 90);
        using var contentStream = data.AsStream();

        var imageUrl = _gateway.UploadImage("test.jpg", "description", "me", contentStream,
            new Coordinate(35.2137, 31.7683)).Result;

        StringAssert.EndsWith(imageUrl, ".jpg");
    }
}
