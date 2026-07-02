using System;
using System.Security.Cryptography;
using IsraelHiking.API.Executors;
using IsraelHiking.Common;
using IsraelHiking.DataAccessInterfaces.Repositories;
using Microsoft.Extensions.Logging;
using Microsoft.VisualStudio.TestTools.UnitTesting;
using NSubstitute;

namespace IsraelHiking.API.Tests.Executors;

[TestClass]
public class ImagesUrlsStorageExecutorTests
{
    private ImagesUrlsStorageExecutor _executor;
    private IImagesRepository _imagesRepository;
    private const string SINGLE_PIXEL_PNG =
        "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=";

    [TestInitialize]
    public void TestInitialize()
    {
        _imagesRepository = Substitute.For<IImagesRepository>();
        _executor = new ImagesUrlsStorageExecutor(_imagesRepository, Substitute.For<ILogger>());
    }

    [TestMethod]
    public void GetImageUrlIfExists_UrlExists_ShouldGetIt()
    {
        _imagesRepository.GetImageByHash(Arg.Any<string>())
            .Returns(new ImageItem {ImageUrls = ["imageUrl"] });

        var results = _executor.GetImageUrlIfExists(MD5.Create(), Convert.FromBase64String(SINGLE_PIXEL_PNG)).Result;

        Assert.IsNotNull(results);
    }
}
