using IsraelHiking.Common.Configuration;
using Microsoft.Extensions.Options;
using Microsoft.VisualStudio.TestTools.UnitTesting;
using NetTopologySuite.Geometries;
using NSubstitute;
using SkiaSharp;
using System;
using System.Net.Http;

namespace IsraelHiking.DataAccess.Tests;

[TestClass]
public class PanoramaxGatewayTests
{
    private PanoramaxGateway _gateway;

    [TestInitialize]
    public void TestInitialize()
    {
        var factory = Substitute.For<IHttpClientFactory>();
        factory.CreateClient().Returns(_ => new HttpClient());
        var options = Substitute.For<IOptions<ConfigurationData>>();
        options.Value.Returns(new ConfigurationData());
        var nonPublicOptions = Substitute.For<IOptions<NonPublicConfigurationData>>();
        nonPublicOptions.Value.Returns(new NonPublicConfigurationData());
        _gateway = new PanoramaxGateway(factory, options, nonPublicOptions, new TraceLogger());
    }

    /// <remarks>
    /// The picture is a single pixel with no EXIF of its own, so this also covers the case of an instance
    /// refusing a picture that carries no capture time and the gateway sending it again with the upload time.
    /// </remarks>
    [TestMethod]
    [Ignore("Runs against the panoramax instance of docker-compose")]
    public void UploadImage()
    {
        using var bitmap = new SKBitmap(1, 1);
        using var image = SKImage.FromBitmap(bitmap);
        using var data = image.Encode(SKEncodedImageFormat.Jpeg, 90);
        using var contentStream = data.AsStream();

        var uploadedImage = _gateway.UploadImage("test.jpg", "description", "me", contentStream,
            new Coordinate(35.2137, 31.7683)).Result;

        Assert.IsTrue(Guid.TryParse(uploadedImage.PictureId, out _));
    }
}
