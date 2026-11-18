using System.Collections.Generic;
using System.Net;
using System.Net.Http;
using IsraelHiking.API.Controllers;
using IsraelHiking.DataAccessInterfaces;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Primitives;
using Microsoft.VisualStudio.TestTools.UnitTesting;
using NSubstitute;

namespace IsraelHiking.API.Tests.Controllers;

[TestClass]
public class GarminControllerTests
{
    private GarminController _controller;
    private IGarminGateway _garminGateway;

    [TestInitialize]
    public void TestInitialize()
    {
        _garminGateway = Substitute.For<IGarminGateway>();
        _controller = new GarminController(_garminGateway)
        {
            ControllerContext = new ControllerContext { HttpContext = new DefaultHttpContext() }
        };
    }

    [TestMethod]
    public void GetCallback_FromTheApp_ShouldRedirectToTheApp()
    {
        _controller.Request.QueryString = new QueryString("?code=c&state=app-123");

        var result = _controller.GetCallback() as RedirectResult;

        Assert.AreEqual("mapeak://oauth_callback/?code=c&state=app-123", result.Url);
    }

    [TestMethod]
    public void GetCallback_FromTheSite_ShouldRedirectToTheSitePage()
    {
        _controller.Request.QueryString = new QueryString("?code=c&state=web-123");

        var result = _controller.GetCallback() as RedirectResult;

        Assert.AreEqual("/device-oauth.html?code=c&state=web-123", result.Url);
    }

    [TestMethod]
    public void PostToken_ShouldForwardTheFormAndRelayGarminsResponse()
    {
        var form = new FormCollection(new Dictionary<string, StringValues>
        {
            { "grant_type", "refresh_token" },
            { "refresh_token", "refresh" }
        });
        _garminGateway.RequestToken(Arg.Any<IEnumerable<KeyValuePair<string, string>>>()).Returns(new HttpResponseMessage(HttpStatusCode.BadRequest) { Content = new StringContent("{}") });

        var result = _controller.PostToken(form).Result as ContentResult;

        Assert.AreEqual(400, result.StatusCode);
        Assert.AreEqual("{}", result.Content);
        _garminGateway.Received().RequestToken(Arg.Is<IEnumerable<KeyValuePair<string, string>>>(p =>
            new Dictionary<string, string>(p)["refresh_token"] == "refresh"));
    }
}
