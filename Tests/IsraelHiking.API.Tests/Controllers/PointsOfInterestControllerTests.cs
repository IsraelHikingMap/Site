﻿using System.IO;
using GeoAPI.Geometries;
using IsraelHiking.API.Controllers;
using IsraelHiking.API.Services;
using IsraelHiking.API.Services.Poi;
using IsraelHiking.Common;
using IsraelHiking.DataAccessInterfaces;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using Microsoft.VisualStudio.TestTools.UnitTesting;
using NSubstitute;

namespace IsraelHiking.API.Tests.Controllers
{
    [TestClass]
    public class PointsOfInterestControllerTests
    {
        private IWikipediaGateway _wikipediaGateway;
        private PointsOfInterestController _controller;
        private ITagsHelper _tagHelper;
        private IPointsOfInterestAdapter _adapter;

        [TestInitialize]
        public void TestInitialize()
        {
            _adapter = Substitute.For<IPointsOfInterestAdapter>();
            _adapter.Source.Returns("source");
            _tagHelper = Substitute.For<ITagsHelper>();
            _wikipediaGateway = Substitute.For<IWikipediaGateway>();
            var cache = new LruCache<string, TokenAndSecret>(Substitute.For<IOptions<ConfigurationData>>(), Substitute.For<ILogger>());
            _controller = new PointsOfInterestController(new [] { _adapter }, _tagHelper, _wikipediaGateway, cache);
        }

        [TestMethod]
        public void GetCategoriesByType_ShouldGetThemFromTagHelper()
        {
            var category = "category";

            _controller.GetCategoriesByType(category);

            _tagHelper.Received(1).GetIconsPerCategoryByType(category);
        }

        [TestMethod]
        public void GetPointsOfIntereset_NoCategory_ShouldReturnEmptyList()
        {
            var result = _controller.GetPointsOfInterest(string.Empty, string.Empty, string.Empty).Result;

            Assert.AreEqual(0, result.Length);
            _adapter.DidNotReceive().GetPointsOfInterest(Arg.Any<Coordinate>(), Arg.Any<Coordinate>(), Arg.Any<string[]>(), Arg.Any<string>());
        }

        [TestMethod]
        public void GetPointsOfIntereset_OneAdapter_ShouldReturnPoi()
        {
            _adapter.GetPointsOfInterest(Arg.Any<Coordinate>(), Arg.Any<Coordinate>(), Arg.Any<string[]>(),
                Arg.Any<string>()).Returns(new[] {new PointOfInterest()});

            var result = _controller.GetPointsOfInterest(string.Empty, string.Empty, "category", "language").Result;

            Assert.AreEqual(1, result.Length);
        }

        [TestMethod]
        public void GetPointOfIntereset_WrongSource_ShouldReturnBadRequest()
        {
            var result = _controller.GetPointOfInterest("wrong source", string.Empty, "category", "language").Result as BadRequestObjectResult;

            Assert.IsNotNull(result);
        }

        [TestMethod]
        public void GetPointOfIntereset_WrongId_ShouldReturnNotFound()
        {
            var result = _controller.GetPointOfInterest("source", string.Empty, "language", string.Empty).Result as NotFoundResult;

            Assert.IsNotNull(result);
        }

        [TestMethod]
        public void GetPointOfIntereset_BySourceAndId_ShouldReturnIt()
        {
            var id = "1";
            var source = "source";
            var language = "language";
            var type = "way";
            _adapter.GetPointOfInterestById(id, language, type).Returns(new PointOfInterestExtended());

            var result = _controller.GetPointOfInterest(source, id, language, type).Result as OkObjectResult;

            Assert.IsNotNull(result);
        }

        [TestMethod]
        public void UploadPointOfInterest_WrongSource_ShouldReturnBadRequest()
        {
            var poi = new PointOfInterestExtended {Source = "wrong source"};

            var result = _controller.UploadPointOfInterest(poi).Result as BadRequestObjectResult;

            Assert.IsNotNull(result);
        }

        [TestMethod]
        public void UploadPointOfInterest_IdDoesNotExists_ShouldAdd()
        {
            _controller.SetupIdentity();
            var poi = new PointOfInterestExtended { Source = "source", Id = "" };

            var result = _controller.UploadPointOfInterest(poi).Result as OkObjectResult;

            Assert.IsNotNull(result);
            _adapter.Received(1).AddPointOfInterest(Arg.Any<PointOfInterestExtended>(), Arg.Any<TokenAndSecret>(), Arg.Any<string>());
        }

        [TestMethod]
        public void UploadPointOfInterest_IdExists_ShouldUpdate()
        {
            _controller.SetupIdentity();
            var poi = new PointOfInterestExtended { Source = "source", Id = "1" };

            var result = _controller.UploadPointOfInterest(poi).Result as OkObjectResult;

            Assert.IsNotNull(result);
            _adapter.Received(1).UpdatePointOfInterest(Arg.Any<PointOfInterestExtended>(), Arg.Any<TokenAndSecret>(), Arg.Any<string>());
        }

        [TestMethod]
        public void UploadImage_ShouldUpload()
        {
            var formFile = Substitute.For<IFormFile>();
            formFile.OpenReadStream().Returns(new MemoryStream());
            formFile.FileName.Returns("file.jpg");
            _controller.UploadImage(formFile, "title", "1,2").Wait();

            _wikipediaGateway.Received(1).UploadImage("title", "file.jpg", Arg.Any<Stream>(), Arg.Any<Coordinate>());
            _wikipediaGateway.Received(1).GetImageUrl(Arg.Any<string>());
        }
    }
}
