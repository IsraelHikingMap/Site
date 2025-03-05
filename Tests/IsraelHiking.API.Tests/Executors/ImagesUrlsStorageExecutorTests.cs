using System;
using System.Linq;
using System.Security.Cryptography;
using IsraelHiking.API.Executors;
using IsraelHiking.Common;
using IsraelHiking.Common.Api;
using IsraelHiking.DataAccessInterfaces;
using IsraelHiking.DataAccessInterfaces.Repositories;
using Microsoft.Extensions.Logging;
using Microsoft.VisualStudio.TestTools.UnitTesting;
using NSubstitute;
using NSubstitute.ExceptionExtensions;

namespace IsraelHiking.API.Tests.Executors;

[TestClass]
public class ImagesUrlsStorageExecutorTests
{
    private ImagesUrlsStorageExecutor _executor;
    private IImagesRepository _imagesRepository;
    private IRemoteFileSizeFetcherGateway _remoteFileSizeFetcherGateway;
    private const string SINGLE_PIXEL_PNG =
        "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=";
        
    [TestInitialize]
    public void TestInitialize()
    {
        _imagesRepository = Substitute.For<IImagesRepository>();
        _remoteFileSizeFetcherGateway = Substitute.For<IRemoteFileSizeFetcherGateway>();
        _executor = new ImagesUrlsStorageExecutor(_imagesRepository, _remoteFileSizeFetcherGateway, Substitute.For<ILogger>());
            
    }

    [TestMethod]
    public void DownloadAndStoreUrls_ImagesInDatabaseAreNotRelevant_ShouldDeleteThem()
    {
        var olderImageUrl = "olderImageUrl";
        _imagesRepository.GetAllUrls().Returns([olderImageUrl]);
        _executor.DownloadAndStoreUrls([]).Wait();

        _imagesRepository.DidNotReceive().StoreImage(Arg.Any<ImageItem>());
        _imagesRepository.Received(1).DeleteImageByUrl(olderImageUrl);
    }
        
    [TestMethod]
    public void DownloadAndStoreUrls_ImagesInDatabaseAreUpToDate_ShouldNotDoAnything()
    {
        var existingImageUrl = "existingImageUrl";
        _imagesRepository.GetAllUrls().Returns([existingImageUrl]);
        _remoteFileSizeFetcherGateway.GetFileSize(existingImageUrl).Returns(42);
            
        _executor.DownloadAndStoreUrls([existingImageUrl]).Wait();

        _imagesRepository.DidNotReceive().StoreImage(Arg.Any<ImageItem>());
    }
        
    [TestMethod]
    public void DownloadAndStoreUrls_SingleImageNoImagesInDatabase_ShouldSucceed()
    {
        var imageUrl = "imageUrl";
        _imagesRepository.GetAllUrls().Returns([]);
        _remoteFileSizeFetcherGateway.GetFileContent(imageUrl).Returns(new RemoteFileFetcherGatewayResponse
        {
            Content = Convert.FromBase64String(SINGLE_PIXEL_PNG),
            FileName = imageUrl
        });
            
        _executor.DownloadAndStoreUrls([imageUrl]).Wait();

        _imagesRepository.Received(1).StoreImage(Arg.Is<ImageItem>(i => i.ImageUrls.Contains(imageUrl)));
    }
        
    [TestMethod]
    public void DownloadAndStoreUrls_SingleImageNoImagesInDatabase_ShouldFailAllRetries()
    {
        var imageUrl = "imageUrl";
        _imagesRepository.GetAllUrls().Returns([]);
        _remoteFileSizeFetcherGateway.GetFileContent(imageUrl).Throws(new Exception("Error..."));
            
        _executor.DownloadAndStoreUrls([imageUrl]).Wait();

        _imagesRepository.DidNotReceive().StoreImage(Arg.Any<ImageItem>());
    }
        
    [TestMethod]
    public void DownloadAndStoreUrls_WikipediaImageNoImagesInDatabase_ShouldSucceed()
    {
        var imageUrl = "File:imageUrl";
        _imagesRepository.GetAllUrls().Returns([]);
        _remoteFileSizeFetcherGateway.GetFileContent(Arg.Any<string>()).Returns(new RemoteFileFetcherGatewayResponse
        {
            Content = Convert.FromBase64String(SINGLE_PIXEL_PNG),
            FileName = imageUrl
        });
            
        _executor.DownloadAndStoreUrls([imageUrl]).Wait();

        _imagesRepository.Received(1)
            .StoreImage(Arg.Is<ImageItem>(i => i.ImageUrls.Any(u => u.Contains("imageUrl"))));
    }
        
    [TestMethod]
    public void DownloadAndStoreUrls_ImageInDatabaseWithDifferentUrl_ShouldUpdateEntry()
    {
        var imageUrl = "imageUrl";
        var olderImageUrl = "olderImageUrl";
        _imagesRepository.GetAllUrls().Returns([]);
        _imagesRepository.GetImageByHash(Arg.Any<string>()).Returns(new ImageItem
        {
            ImageUrls = [olderImageUrl]
        });
        _remoteFileSizeFetcherGateway.GetFileContent(imageUrl).Returns(new RemoteFileFetcherGatewayResponse
        {
            Content = Convert.FromBase64String(SINGLE_PIXEL_PNG),
            FileName = imageUrl
        });
            
        _executor.DownloadAndStoreUrls([imageUrl]).Wait();

        _imagesRepository.Received(1).StoreImage(Arg.Is<ImageItem>(i => 
            i.ImageUrls.Contains(imageUrl) &&
            i.ImageUrls.Contains(olderImageUrl)));
    }

    [TestMethod]
    public void GetImageUrlIfExists_UrlExists_ShouldGetIt()
    {
        _imagesRepository.GetImageByHash(Arg.Any<string>())
            .Returns(new ImageItem {ImageUrls = ["imageUrl"] });
            
        var results = _executor.GetImageUrlIfExists(MD5.Create(), Convert.FromBase64String(SINGLE_PIXEL_PNG)).Result;

        Assert.IsNotNull(results);
    }

    [TestMethod]
    public void GetAllImagesForUrls_ShouldGetThem()
    {
        var imageUrl = "imageUrl";
        _imagesRepository.GetImageByUrl(imageUrl).Returns(new ImageItem());
            
        var results = _executor.GetAllImagesForUrls([imageUrl]).Result;
            
        Assert.AreEqual(1, results.Length);
    }
}