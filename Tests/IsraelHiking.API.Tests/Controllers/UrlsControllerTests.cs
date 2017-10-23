using System.Collections.Generic;
using IsraelHiking.API.Controllers;
using IsraelHiking.API.Services;
using IsraelHiking.Common;
using IsraelHiking.DataAccessInterfaces;
using Microsoft.VisualStudio.TestTools.UnitTesting;
using Newtonsoft.Json;
using NSubstitute;
using Microsoft.AspNetCore.Mvc;

namespace IsraelHiking.API.Tests.Controllers
{
    [TestClass]
    public class UrlsControllerTests
    {
        private UrlsController _controller;
        private IIsraelHikingRepository _israelHikingRepository;
        private IDataContainerConverterService _containerConverterService;

        [TestInitialize]
        public void TestInitialize()
        {
            _israelHikingRepository = Substitute.For<IIsraelHikingRepository>();
            _containerConverterService = Substitute.For<IDataContainerConverterService>();
            _controller = new UrlsController(_israelHikingRepository, _containerConverterService);
        }

        [TestMethod]
        public void GetSiteUrl_ItemNotInDatabase_ShouldReturnBadRequest()
        {
            var results = _controller.GetSiteUrl("42").Result as BadRequestResult;

            Assert.IsNotNull(results);
        }

        [TestMethod]
        public void GetSiteUrl_ItemInDatabase_ShouldReturnIt()
        {
            var id = "someId";
            _israelHikingRepository.GetUrlById(id).Returns(new SiteUrl { Id = id });

            var results = _controller.GetSiteUrl(id).Result as OkObjectResult;

            Assert.IsNotNull(results);
            var content = results.Value as SiteUrl;
            Assert.IsNotNull(results);
            Assert.AreEqual(id, content.Id);
        }

        [TestMethod]
        public void GetSiteUrl_ItemInDatabase_ShouldReturnItAccordingToFromat()
        {
            var id = "someId";
            var bytes = new byte[] { 1 };
            _israelHikingRepository.GetUrlById(id).Returns(new SiteUrl { Id = id, JsonData = JsonConvert.SerializeObject(new DataContainer()) });
            _containerConverterService.ToAnyFormat(Arg.Any<DataContainer>(), "gpx").Returns(bytes);

            var results = _controller.GetSiteUrl(id, "gpx").Result as FileContentResult;

            Assert.IsNotNull(results);
            var content = results.FileContents;
            Assert.IsNotNull(content);
            Assert.AreEqual(bytes.Length, content.Length);
        }

        [TestMethod]
        public void GetSiteUrlForUser_ItemInDatabase_ShouldReturnItAccordingToFromat()
        {
            var id = "someId";
            var list = new List<SiteUrl> { new SiteUrl { OsmUserId = id } };
            _controller.SetupIdentity(id);
            _israelHikingRepository.GetUrlsByUser(id).Returns(list);

            var results = _controller.GetSiteUrlForUser().Result as OkObjectResult;

            Assert.IsNotNull(results);
            Assert.AreEqual(list.Count, (results.Value as List<SiteUrl>).Count);
        }

        [TestMethod]
        public void PostSiteUrl_IncorrectUser_ShouldReturnBadRequest()
        {
            var url = new SiteUrl { OsmUserId = "1" };
            _controller.SetupIdentity("2");

            var results = _controller.PostSiteUrl(url).Result as BadRequestObjectResult;

            Assert.IsNotNull(results);
        }

        [TestMethod]
        public void PostSiteUrl_RandomHitsItemInDatabase_ShouldAddSiteUrl()
        {
            // first fetch from repository returns an item while the second one doesn't
            _israelHikingRepository.GetUrlById(Arg.Any<string>())
                .Returns(x => new SiteUrl(), x => null as SiteUrl);

            var results = _controller.PostSiteUrl(new SiteUrl()).Result as OkObjectResult;

            Assert.IsNotNull(results);
            var content = results.Value as SiteUrl;
            Assert.IsNotNull(results);
            Assert.AreEqual(10, content.Id.Length);
        }

        [TestMethod]
        public void PutSiteUrl_ItemNotInDatabase_ShouldReturnBadRequest()
        {
            var siteUrl = new SiteUrl { Id = "42", OsmUserId = "42" };
            _israelHikingRepository.GetUrlById(siteUrl.Id).Returns((SiteUrl)null);

            var results = _controller.PutSiteUrl(siteUrl.Id, siteUrl).Result as NotFoundResult;

            Assert.IsNotNull(results);
            _israelHikingRepository.DidNotReceive().Update(Arg.Any<SiteUrl>());
        }

        [TestMethod]
        public void PutSiteUrl_ItemDoesNotBelongToUSer_ShouldReturnBadRequest()
        {
            var siteUrl = new SiteUrl { Id = "42", OsmUserId = "42" };
            _israelHikingRepository.GetUrlById(siteUrl.Id).Returns(siteUrl);
            _controller.SetupIdentity("1");

            var results = _controller.PutSiteUrl(siteUrl.Id, siteUrl).Result as BadRequestObjectResult;

            Assert.IsNotNull(results);
            _israelHikingRepository.DidNotReceive().Update(Arg.Any<SiteUrl>());
        }

        [TestMethod]
        public void PutSiteUrl_ItemBelongsToUSer_ShouldUpdateIt()
        {
            var siteUrl = new SiteUrl { Id = "1", OsmUserId = "1" };
            _israelHikingRepository.GetUrlById(siteUrl.Id).Returns(siteUrl);
            _controller.SetupIdentity(siteUrl.OsmUserId);

            var results = _controller.PutSiteUrl(siteUrl.Id, siteUrl).Result as OkObjectResult;

            Assert.IsNotNull(results);
            _israelHikingRepository.Received(1).Update(Arg.Any<SiteUrl>());
        }

        [TestMethod]
        public void DeleteSiteUrl_ItemNotInDatabase_ShouldReturnNotFound()
        {
            var id = "42";
            _israelHikingRepository.GetUrlById(id).Returns(null as SiteUrl);

            var result = _controller.DeleteSiteUrl(id).Result as NotFoundResult;

            Assert.IsNotNull(result);
        }

        [TestMethod]
        public void DeleteSiteUrl_ItemUserIdDoesNotMatchUSer_ShouldReturnBadRequest()
        {
            _controller.SetupIdentity("1");
            var siteUrl = new SiteUrl { Id = "11", OsmUserId = "11" };
            _israelHikingRepository.GetUrlById(siteUrl.Id).Returns(siteUrl);

            var result = _controller.DeleteSiteUrl(siteUrl.Id).Result as BadRequestObjectResult;

            Assert.IsNotNull(result);
        }


        [TestMethod]
        public void DeleteSiteUrl_ItemInDatabase_ShouldRemoveIt()
        {
            var siteUrl = new SiteUrl { Id = "42", OsmUserId = "42" };
            _israelHikingRepository.GetUrlById(siteUrl.Id).Returns(siteUrl);
            _controller.SetupIdentity(siteUrl.OsmUserId);

            _controller.DeleteSiteUrl(siteUrl.Id).Wait();

            _israelHikingRepository.Received(1).Delete(siteUrl);
            _controller.Dispose();
        }
    }
}
