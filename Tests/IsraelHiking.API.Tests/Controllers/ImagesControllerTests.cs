using IsraelHiking.API.Controllers;
using IsraelHiking.Common;
using IsraelHiking.Common.DataContainer;
using IsraelHiking.DataAccessInterfaces;
using IsraelHiking.DataAccessInterfaces.Repositories;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.VisualStudio.TestTools.UnitTesting;
using NSubstitute;
using System.IO;
using IsraelHiking.API.Converters;

namespace IsraelHiking.API.Tests.Controllers;

[TestClass]
public class ImagesControllerTests
{
    private ImagesController _controller;
    private IShareUrlsRepository _repository;
    private IImageCreationGateway _imageCreationGateway;
    private IImgurGateway _imgurGateway;

    [TestInitialize]
    public void TestInitialize()
    {
        _repository = Substitute.For<IShareUrlsRepository>();
        _imageCreationGateway = Substitute.For<IImageCreationGateway>();
        _imgurGateway = Substitute.For<IImgurGateway>();
            
        _controller = new ImagesController(_repository, _imageCreationGateway, _imgurGateway, new Base64ImageStringToFileConverter());
    }

    [TestMethod]
    public void GetImage_ShouldCreateOne()
    {
        var results = _controller.GetImage(32, 35, 100, 100).Result as FileContentResult;

        Assert.IsNotNull(results);
    }

    [TestMethod]
    public void GetImageForShare_NoUrl_ShouldNotFound()
    {
        var results = _controller.GetImageForShare("42").Result as NotFoundResult;

        Assert.IsNotNull(results);
    }

    [TestMethod]
    public void GetImageForShare_UrlInDatabase_ShouldCreateIt()
    {
        var siteUrl = new ShareUrl
        {
            Id = "1",
            DataContainer = new DataContainerPoco()
        };
        _repository.GetUrlById(siteUrl.Id).Returns(siteUrl);

        var results = _controller.GetImageForShare(siteUrl.Id).Result as FileContentResult;

        Assert.IsNotNull(results);
    }
    
    [TestMethod]
    public void GetImageForShare_ImageInDatabase_ShouldReturnIt()
    {
        var siteUrl = new ShareUrl
        {
            Id = "1",
            Base64Preview = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAUAAAAFCAYAAACNbyblAAAAHElEQVQI12P4//8/w38GIAXDIBKE0DHxgljNBAAO9TXL0Y4OHwAAAABJRU5ErkJggg=="
        };
        _repository.GetUrlById(siteUrl.Id).Returns(siteUrl);

        var results = _controller.GetImageForShare(siteUrl.Id).Result as FileContentResult;

        Assert.IsNotNull(results);
    }

    [TestMethod]
    public void PostDataContainer_ShouldCreateImage()
    {
        var dataContainer = new DataContainerPoco();

        _controller.PostDataContainer(dataContainer).Wait();

        _imageCreationGateway.Received(1).Create(dataContainer, Arg.Any<int>(), Arg.Any<int>());
    }

    [TestMethod]
    public void PostUploadImage_ShouldUpload()
    {
        var expectedLink = "link";
        var file = Substitute.For<IFormFile>();
        var fileStreamMock = new MemoryStream();
        file.OpenReadStream().Returns(fileStreamMock);
        _imgurGateway.UploadImage(fileStreamMock).Returns(expectedLink);

        var results = _controller.PostUploadImage(file).Result;

        Assert.AreEqual(expectedLink, results);
    }
}