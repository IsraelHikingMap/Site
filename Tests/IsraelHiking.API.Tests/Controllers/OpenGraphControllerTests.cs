using IsraelHiking.API.Controllers;
using IsraelHiking.Common;
using IsraelHiking.DataAccessInterfaces;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Logging;
using Microsoft.VisualStudio.TestTools.UnitTesting;
using NSubstitute;

namespace IsraelHiking.API.Tests.Controllers
{
    [TestClass]
    public class OpenGraphControllerTests
    {
        private OpenGraphController _controller;
        private IRepository _repository;

        [TestInitialize]
        public void TestInitiazlie()
        {
            var urlHelper = Substitute.For<IUrlHelper>();
            urlHelper.Content(Arg.Any<string>()).Returns(x => x[0]);
            _repository = Substitute.For<IRepository>();
            _controller = new OpenGraphController(_repository, Substitute.For<ILogger>()) { Url = urlHelper };
        }

        [TestMethod]
        public void GetHtml_WithTitle_ShouldReturnIt()
        {
            _repository.GetUrlById(Arg.Any<string>()).Returns(new ShareUrl { Title = "somthing with <>\"" });

            var response = _controller.GetHtml("42").Result as ContentResult;

            Assert.IsNotNull(response);
            var pageHtml = response.Content;
            Assert.IsTrue(pageHtml.Contains("api/images"));
            Assert.IsTrue(pageHtml.Contains("&gt;"));
            Assert.IsTrue(pageHtml.Contains("&lt;"));
            Assert.IsTrue(pageHtml.Contains("&quot;"));
        }

        [TestMethod]
        public void GetHtml_WithNoTitle_ShouldReturnIt()
        {
            _repository.GetUrlById(Arg.Any<string>()).Returns(new ShareUrl { Title = "   " });

            var response = _controller.GetHtml("42").Result as ContentResult;

            Assert.IsNotNull(response);
            var pageHtml = response.Content;
            Assert.IsTrue(pageHtml.Contains("api/images"));
        }
    }
}
