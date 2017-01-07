using System.Collections.Generic;
using System.Security.Claims;
using System.Security.Principal;
using System.Threading;
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
    public class UrlsControllerTests
    {
        private UrlsController _controller;
        private IIsraelHikingRepository _israelHikingRepository;
        private IDataContainerConverterService _containerConverterService;

        private void SetupIdentity(string osmUserId = "42")
        {
            var identity = new GenericIdentity(osmUserId);
            identity.AddClaim(new Claim(ClaimTypes.Name, osmUserId));

            Thread.CurrentPrincipal = new GenericPrincipal(identity, new string[0]);
        }

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
            _israelHikingRepository.GetUrlById(id).Returns(Task.FromResult(new SiteUrl {Id = id}));

            var results = _controller.GetSiteUrl(id).Result as OkNegotiatedContentResult<SiteUrl>;

            Assert.IsNotNull(results);
            var content = results.Content;
            Assert.IsNotNull(results);
            Assert.AreEqual(id, content.Id);
        }

        [TestMethod]
        public void GetSiteUrl_ItemInDatabase_ShouldReturnItAccordingToFromat()
        {
            var id = "someId";
            var bytes = new byte[] {1};
            _israelHikingRepository.GetUrlById(id).Returns(Task.FromResult(new SiteUrl { Id = id, JsonData = JsonConvert.SerializeObject(new DataContainer()) }));
            _containerConverterService.ToAnyFormat(Arg.Any<DataContainer>(), "gpx").Returns(Task.FromResult(bytes));

            var results = _controller.GetSiteUrl(id, "gpx").Result as ResponseMessageResult;

            Assert.IsNotNull(results);
            var content = results.Response.Content;
            Assert.IsNotNull(content);
            Assert.AreEqual(bytes.Length, content.ReadAsByteArrayAsync().Result.Length);
        }

        [TestMethod]
        public void GetSiteUrlForUser_ItemInDatabase_ShouldReturnItAccordingToFromat()
        {
            var id = "someId";
            var list = new List<SiteUrl> {new SiteUrl {OsmUserId = id}};
            SetupIdentity(id);
            _israelHikingRepository.GetUrlsByUser(id).Returns(Task.FromResult(list));

            var results = _controller.GetSiteUrlForUser().Result as OkNegotiatedContentResult<List<SiteUrl>>;

            Assert.IsNotNull(results);
            Assert.AreEqual(list.Count, results.Content.Count);
        }

        [TestMethod]
        public void PostSiteUrl_IncorrectUser_ShouldReturnBadRequest()
        {
            var url = new SiteUrl {OsmUserId = "1"};
            SetupIdentity("2");

            var results = _controller.PostSiteUrl(url).Result as BadRequestErrorMessageResult;

            Assert.IsNotNull(results);
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

            Assert.IsNotNull(results);
            var content = results.Content;
            Assert.IsNotNull(results);
            Assert.AreEqual(10, content.Id.Length);
        }

        [TestMethod]
        public void PutSiteUrl_ItemNotInDatabase_ShouldReturnBadRequest()
        {
            var siteUrl = new SiteUrl { Id = "42", OsmUserId = "42" };
            _israelHikingRepository.GetUrlById(siteUrl.Id).Returns(Task.FromResult<SiteUrl>(null));

            var results = _controller.PutSiteUrl(siteUrl.Id, siteUrl).Result as NotFoundResult;

            Assert.IsNotNull(results);
            _israelHikingRepository.DidNotReceive().Update(Arg.Any<SiteUrl>());
        }

        [TestMethod]
        public void PutSiteUrl_ItemDoesNotBelongToUSer_ShouldReturnBadRequest()
        {
            var siteUrl = new SiteUrl { Id = "42", OsmUserId = "42" };
            _israelHikingRepository.GetUrlById(siteUrl.Id).Returns(Task.FromResult(siteUrl));
            SetupIdentity("1");

            var results = _controller.PutSiteUrl(siteUrl.Id, siteUrl).Result as BadRequestErrorMessageResult;

            Assert.IsNotNull(results);
            _israelHikingRepository.DidNotReceive().Update(Arg.Any<SiteUrl>());
        }

        [TestMethod]
        public void PutSiteUrl_ItemBelongsToUSer_ShouldUpdateIt()
        {
            var siteUrl = new SiteUrl { Id = "1", OsmUserId = "1" };
            _israelHikingRepository.GetUrlById(siteUrl.Id).Returns(Task.FromResult(siteUrl));
            SetupIdentity(siteUrl.OsmUserId);

            var results = _controller.PutSiteUrl(siteUrl.Id, siteUrl).Result as OkNegotiatedContentResult<SiteUrl>;

            Assert.IsNotNull(results);
            _israelHikingRepository.Received(1).Update(Arg.Any<SiteUrl>());
        }


        [TestMethod]
        public void DeleteSiteUrl_ItemNotInDatabase_ShouldRemoveIt()
        {
            var siteUrl = new SiteUrl { Id = "42", OsmUserId = "42" };
            _israelHikingRepository.GetUrlById(siteUrl.Id).Returns(Task.FromResult(siteUrl));
            SetupIdentity(siteUrl.OsmUserId);

            _controller.DeleteSiteUrl(siteUrl.Id).Wait();

            _israelHikingRepository.Received(1).Delete(siteUrl);
            _controller.Dispose();
        }
    }
}
