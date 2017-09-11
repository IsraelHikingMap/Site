using System.Collections.Generic;
using System.IO;
using GeoAPI.Geometries;
using IsraelHiking.API.Controllers;
using IsraelHiking.API.Services;
using IsraelHiking.API.Services.Poi;
using IsraelHiking.Common;
using IsraelHiking.DataAccessInterfaces;
using Microsoft.AspNetCore.Http;
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

        [TestInitialize]
        public void TestInitialize()
        {
            var adapters = new List<IPointsOfInterestAdapter>();
            var tagHelper = Substitute.For<ITagsHelper>();
            _wikipediaGateway = Substitute.For<IWikipediaGateway>();
            _controller = new PointsOfInterestController(adapters, tagHelper, _wikipediaGateway, new LruCache<string, TokenAndSecret>(Substitute.For<IOptions<ConfigurationData>>(), Substitute.For<ILogger>()));
        }

        [TestMethod]
        [Ignore]
        public void UploadFileTest()
        {
            var formFile = Substitute.For<IFormFile>();
            formFile.OpenReadStream().Returns(new FileStream(@"C:\Users\harel\Desktop\Font\flowers.svg", FileMode.Open,
                FileAccess.Read));
            formFile.Name.Returns("flowers.svg");
            _controller.UploadImage(formFile, "title", "1,2").Wait();

            _wikipediaGateway.Received(1).UploadImage(Arg.Any<string>(), Arg.Any<Stream>(), Arg.Any<Coordinate>());
            _wikipediaGateway.Received(1).GetImageUrl(Arg.Any<string>());
        }
    }
}
