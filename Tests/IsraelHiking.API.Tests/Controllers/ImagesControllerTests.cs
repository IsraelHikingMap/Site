using System.Threading.Tasks;
using System.Web.Http.Results;
using IsraelHiking.API.Controllers;
using IsraelHiking.API.Services;
using IsraelHiking.Common;
using IsraelHiking.DataAccessInterfaces;
using Microsoft.VisualStudio.TestTools.UnitTesting;
using Newtonsoft.Json;
using NSubstitute;

namespace IsraelHiking.API.Tests.Controllers
{
    [TestClass]
    public class ImagesControllerTests
    {
        private ImagesController _controller;
        private IIsraelHikingRepository _repository;
        private IImageCreationService _imageCreationService;

        [TestInitialize]
        public void TestInitialize()
        {
            _repository = Substitute.For<IIsraelHikingRepository>();
            _imageCreationService = Substitute.For<IImageCreationService>();
            _controller = new ImagesController(_repository, _imageCreationService);
        }

        [TestMethod]
        public void GetImage_NoUrl_ShouldNotFound()
        {
            var results = _controller.GetImage("42").Result as NotFoundResult;

            Assert.IsNotNull(results);
        }

        [TestMethod]
        public void GetImage_UrlInDatabase_ShouldCreateIt()
        {
            var siteUrl = new SiteUrl
            {
                Id = "1",
                JsonData = JsonConvert.SerializeObject(new DataContainer())
            };
            _repository.GetUrlById(siteUrl.Id).Returns(Task.FromResult(siteUrl));

            var results = _controller.GetImage(siteUrl.Id).Result as ResponseMessageResult;

            Assert.IsNotNull(results);
        }
    }
}
