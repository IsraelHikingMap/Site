﻿using IsraelHiking.API.Controllers;
using IsraelHiking.API.Services;
using IsraelHiking.Common;
using IsraelHiking.Common.Configuration;
using IsraelHiking.Common.DataContainer;
using IsraelHiking.DataAccessInterfaces;
using IsraelHiking.DataAccessInterfaces.Repositories;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Options;
using Microsoft.VisualStudio.TestTools.UnitTesting;
using NSubstitute;
using System.IO;

namespace IsraelHiking.API.Tests.Controllers
{
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
            var options = Substitute.For<IOptions<ConfigurationData>>();
            options.Value.Returns(new ConfigurationData());
            
            _controller = new ImagesController(_repository, _imageCreationGateway, _imgurGateway, options);
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
}
