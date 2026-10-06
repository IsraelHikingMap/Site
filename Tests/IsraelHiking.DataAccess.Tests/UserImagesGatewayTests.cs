using IsraelHiking.Common.Configuration;
using IsraelHiking.DataAccessInterfaces;
using Microsoft.Extensions.Options;
using Microsoft.VisualStudio.TestTools.UnitTesting;
using NetTopologySuite.Geometries;
using NSubstitute;
using System;
using System.Net.Http;

namespace IsraelHiking.DataAccess.Tests;

[TestClass]
public class UserImagesGatewayTests
{
    /// <summary>A 1x1 JPEG, so that the test does not need an image library to make one</summary>
    private const string ONE_PIXEL_JPEG = "/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAMCAgMCAgMDAwMEAwMEBQgFBQQEBQoHBwYIDAoMDAsKCwsNDhIQDQ4RDgsLEBYQERMUFRUVDA8XGBYUGBIUFRT/wAALCAABAAEBAREA/8QAHwAAAQUBAQEBAQEAAAAAAAAAAAECAwQFBgcICQoL/8QAtRAAAgEDAwIEAwUFBAQAAAF9AQIDAAQRBRIhMUEGE1FhByJxFDKBkaEII0KxwRVS0fAkM2JyggkKFhcYGRolJicoKSo0NTY3ODk6Q0RFRkdISUpTVFVWV1hZWmNkZWZnaGlqc3R1dnd4eXqDhIWGh4iJipKTlJWWl5iZmqKjpKWmp6ipqrKztLW2t7i5usLDxMXGx8jJytLT1NXW19jZ2uHi4+Tl5ufo6erx8vP09fb3+Pn6/9oACAEBAAA/AP1Tr//Z";

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

        Assert.ThrowsException<AggregateException>(() => _ = _gateway
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
        using var contentStream = new System.IO.MemoryStream(Convert.FromBase64String(ONE_PIXEL_JPEG));

        var imageUrl = _gateway.UploadImage("test.jpg", "description", "me", contentStream,
            new Coordinate(35.2137, 31.7683)).Result;

        StringAssert.EndsWith(imageUrl, ".jpg");
    }
}
