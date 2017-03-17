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
        [TestMethod]
        public void GetHtml_ShouldReturnIt()
        {
            var urlHelper = Substitute.For<IUrlHelper>();
            urlHelper.Content(Arg.Any<string>()).Returns(x => x[0]);
            var repository = Substitute.For<IIsraelHikingRepository>();
            repository.GetUrlById(Arg.Any<string>()).Returns(new SiteUrl { Title = "somthing with <>\""});
            var controller = new OpenGraphController(repository, Substitute.For<ILogger>()) { Url = urlHelper };

            var response = controller.GetHtml("42").Result as ContentResult;

            Assert.IsNotNull(response);
            var pageHtml = response.Content;
            Assert.IsTrue(pageHtml.Contains("api/images"));
            Assert.IsTrue(pageHtml.Contains("&gt;"));
            Assert.IsTrue(pageHtml.Contains("&lt;"));
            Assert.IsTrue(pageHtml.Contains("&quot;"));
        }
    }
}
