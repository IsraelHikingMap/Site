using IsraelHiking.API.Controllers;
using IsraelHiking.Common;
using IsraelHiking.DataAccessInterfaces;
using Microsoft.VisualStudio.TestTools.UnitTesting;
using NSubstitute;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Logging;

namespace IsraelHiking.API.Tests.Controllers
{
    [TestClass]
    public class OpenGraphControllerTests
    {
        private OpenGraphController _controller;
        private IIsraelHikingRepository _israelHikingRepository;

        [TestInitialize]
        public void TestInitiazlie()
        {
            var urlHelper = Substitute.For<IUrlHelper>();
            urlHelper.Content(Arg.Any<string>()).Returns(x => x[0]);
            _israelHikingRepository = Substitute.For<IIsraelHikingRepository>();
            _controller = new OpenGraphController(_israelHikingRepository, Substitute.For<ILogger>()) { Url = urlHelper };
        }

        [TestMethod]
        public void GetHtml_WithTitle_ShouldReturnIt()
        {
            _israelHikingRepository.GetUrlById(Arg.Any<string>()).Returns(new SiteUrl { Title = "somthing with <>\"" });

            var response = _controller.GetHtml("42").Result as ContentResult;

            Assert.IsNotNull(response);
            var pageHtml = response.Content;
            Assert.IsTrue(pageHtml.Contains("api/images"));
            Assert.IsTrue(pageHtml.Contains("&gt;"));
            Assert.IsTrue(pageHtml.Contains("&lt;"));
            Assert.IsTrue(pageHtml.Contains("&quot;"));

            _controller.Dispose();
        }

        [TestMethod]
        public void GetHtml_WithNoTitle_ShouldReturnIt()
        {
            _israelHikingRepository.GetUrlById(Arg.Any<string>()).Returns(new SiteUrl { Title = "   " });

            var response = _controller.GetHtml("42").Result as ContentResult;

            Assert.IsNotNull(response);
            var pageHtml = response.Content;
            Assert.IsTrue(pageHtml.Contains("api/images"));

            _controller.Dispose();
        }
    }
}
