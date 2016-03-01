using System;
using System.Collections.Generic;
using System.Threading.Tasks;
using System.Web.Http.Results;
using IsraelHiking.API.Controllers;
using IsraelHiking.Common;
using IsraelHiking.DataAccessInterfaces;
using Microsoft.VisualStudio.TestTools.UnitTesting;
using NSubstitute;

namespace IsraelHiking.API.Tests.Controllers
{
    [TestClass]
    public class UrlsControllerTests
    {
        private UrlsController _controller;
        private IIsraelHikingRepository _israelHikingRepository;

        [TestInitialize]
        public void TestInitialize()
        {
            _israelHikingRepository = Substitute.For<IIsraelHikingRepository>();
            _controller = new UrlsController(_israelHikingRepository);
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
            _israelHikingRepository.GetUrlById(id).Returns(Task.FromResult(new SiteUrl {Id = id}));

            var results = _controller.GetSiteUrl(id).Result as OkNegotiatedContentResult<SiteUrl>;
            var content = results.Content;

            Assert.IsNotNull(results);
            Assert.AreEqual(id, content.Id);
        }

        [TestMethod]
        public void PostSiteUrl_RandomHitsItemInDatabase_ShouldAddSiteUrl()
        {
            var queue = new Queue<SiteUrl>();
            queue.Enqueue(new SiteUrl());
            queue.Enqueue(null);
            _israelHikingRepository.GetUrlById(Arg.Any<string>())
                .Returns(x => Task.FromResult(new SiteUrl()), x => Task.FromResult((SiteUrl) null));

            var results = _controller.PostSiteUrl(new SiteUrl()).Result as OkNegotiatedContentResult<SiteUrl>;
            var content = results.Content;

            Assert.IsNotNull(results);
            Assert.AreEqual(10, content.Id.Length);
        }

        [TestMethod]
        public void PutSiteUrl_ItemNotInDatabase_ShouldNotFound()
        {
            var siteUrl = new SiteUrl { Id = "42" };

            var results = _controller.PutSiteUrl(siteUrl.Id, siteUrl).Result as NotFoundResult;

            Assert.IsNotNull(results);
        }

        [TestMethod]
        public void PutSiteUrl_ItemNotInDatabase_ShouldUpdate()
        {
            var siteUrl = new SiteUrl { Id = "42", ModifyKey = "1" };
            _israelHikingRepository.GetUrlByModifyKey(siteUrl.ModifyKey).Returns(Task.FromResult(siteUrl));

            _controller.PutSiteUrl(siteUrl.ModifyKey, siteUrl).Wait();

            _israelHikingRepository.Received(1).Update(siteUrl);
            _controller.Dispose();
        }
    }
}
