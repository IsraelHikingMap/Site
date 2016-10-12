using System.Net.Http;
using System.Threading.Tasks;
using System.Web.Http.Results;
using System.Web.Http.Routing;
using IsraelHiking.API.Controllers;
using IsraelHiking.Common;
using IsraelHiking.DataAccessInterfaces;
using Microsoft.VisualStudio.TestTools.UnitTesting;
using NSubstitute;

namespace IsraelHiking.API.Tests.Controllers
{
    [TestClass]
    public class OpenGraphControllerTests
    {
        [TestMethod]
        public void GetHtml_ShouldReturnIt()
        {
            var urlHelper = Substitute.For<UrlHelper>();
            urlHelper.Content(Arg.Any<string>()).Returns(x => x[0]);
            var repository = Substitute.For<IIsraelHikingRepository>();
            repository.GetUrlById(Arg.Any<string>()).Returns(Task.FromResult(new SiteUrl()));
            var controller = new OpenGraphController(repository, Substitute.For<ILogger>()) { Url = urlHelper };

            var response = controller.GetHtml("42").Result as ResponseMessageResult;

            Assert.IsNotNull(response);
            var content = response.Response.Content as StringContent;
            Assert.IsNotNull(content);
            var pageHtml = content.ReadAsStringAsync().Result;
            Assert.IsTrue(pageHtml.Contains("api/images"));
        }
    }
}
