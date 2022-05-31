using IsraelHiking.API.Controllers;
using IsraelHiking.API.Tests.Services;
using IsraelHiking.Common;
using IsraelHiking.DataAccessInterfaces.Repositories;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Logging;
using Microsoft.VisualStudio.TestTools.UnitTesting;
using NSubstitute;

namespace IsraelHiking.API.Tests.Controllers
{
    [TestClass]
    public class OpenGraphControllerTests : HomePageHelperFixture
    {
        private OpenGraphController _controller;
        private IShareUrlsRepository _repository;

        [TestInitialize]
        public void TestInitiazlie()
        {
            var urlHelper = Substitute.For<IUrlHelper>();
            urlHelper.Content(Arg.Any<string>()).Returns(x => x[0]);
            _repository = Substitute.For<IShareUrlsRepository>();
            setUpHomePageHelper();
            _controller = new OpenGraphController(_repository, _homePageHelper, Substitute.For<ILogger>())
                { Url = urlHelper };
        }


        private void TestController(ShareUrl shareUrl, string expected_title, string expected_desc)
        {
            _repository.GetUrlById(Arg.Any<string>()).Returns(shareUrl);

            var response = _controller.GetHtml(shareUrl.Id).Result as ContentResult;

            Assert.AreEqual(output, response.Content);

            _repository.Received().GetUrlById(shareUrl.Id);
            var checkUrl = Arg.Is<string>(x => x.EndsWith("/api/images/" + shareUrl.Id));
            _homePageHelper.Received().Render(expected_title, expected_desc, checkUrl);
        }

        [TestMethod]
        public void GetHtml_Route_ShouldReturnIt()
        {
            var title = "foobar";
            var id = "xyzzy";
            var desc = "hello world";
            var shareUrl = new ShareUrl { Id = id, Title = title, Description = desc };

            TestController(shareUrl, title, desc);
        }

        [TestMethod]
        public void GetHtml_WithNoTitle_ShouldReturnIt()
        {
            var shareUrl = new ShareUrl { Id = "42" };
            TestController(shareUrl, Branding.ROUTE_SHARE_DEFAULT_TITLE, Branding.DESCRIPTION);
        }
    }
}