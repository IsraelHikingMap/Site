using IsraelHiking.API.Controllers;
using IsraelHiking.API.Services;
using IsraelHiking.Common;
using IsraelHiking.DataAccessInterfaces.Repositories;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Logging;
using Microsoft.VisualStudio.TestTools.UnitTesting;
using NSubstitute;

namespace IsraelHiking.API.Tests.Controllers;

[TestClass]
public class OpenGraphControllerTests
{
    private OpenGraphController _controller;
    private IShareUrlsRepository _repository;
    private IHomePageHelper _homePageHelper;

    [TestInitialize]
    public void TestInitialize()
    {
        var urlHelper = Substitute.For<IUrlHelper>();
        urlHelper.Content(Arg.Any<string>()).Returns(x => x[0]);
        _repository = Substitute.For<IShareUrlsRepository>();
        _homePageHelper = Substitute.For<IHomePageHelper>();
        _controller = new OpenGraphController(_repository, _homePageHelper, Substitute.For<ILogger>())
            { Url = urlHelper };
    }


    private void TestController(ShareUrl shareUrl, string expectedTitle, string expectedDescription)
    {
        _repository.GetUrlById(Arg.Any<string>()).Returns(shareUrl);
        _homePageHelper.Render(Arg.Any<string>(), Arg.Any<string>(), Arg.Any<string>(), Arg.Any<string>())
            .Returns("OUT");
            
        var response = _controller.GetHtml(shareUrl.Id).Result as ContentResult;
            
        Assert.IsNotNull(response);
        Assert.AreEqual("OUT", response.Content);
        _repository.Received().GetUrlById(shareUrl.Id);
        var checkUrl = Arg.Is<string>(x => x.EndsWith("/api/images/" + shareUrl.Id));
        _homePageHelper.Received().Render(expectedTitle, expectedDescription, checkUrl);
    }

    [TestMethod]
    public void GetHtml_Route_ShouldReturnIt()
    {
        var title = "title";
        var id = "id";
        var description = "description";
        var shareUrl = new ShareUrl { Id = id, Title = title, Description = description };

        TestController(shareUrl, title, description);
    }

    [TestMethod]
    public void GetHtml_WithNoTitle_ShouldReturnIt()
    {
        var shareUrl = new ShareUrl { Id = "42" };
        TestController(shareUrl, Branding.ROUTE_SHARE_DEFAULT_TITLE, Branding.DESCRIPTION);
    }
}