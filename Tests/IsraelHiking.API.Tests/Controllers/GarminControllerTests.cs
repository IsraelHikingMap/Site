using System.Text.Json;
using IsraelHiking.API.Controllers;
using IsraelHiking.Common.Api;
using IsraelHiking.DataAccessInterfaces;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
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
        _controller = new GarminController(_garminGateway);
    }

    [TestMethod]
    public void GetCallback_FromTheApp_ShouldRedirectToTheApp()
    {
        SetupQuery("?code=c&state=app-123");

        var result = _controller.GetCallback() as RedirectResult;

        Assert.AreEqual("mapeak://oauth_callback/?code=c&state=app-123", result.Url);
    }

    [TestMethod]
    public void GetCallback_FromTheSite_ShouldRedirectToTheSitePage()
    {
        SetupQuery("?code=c&state=web-123");

        var result = _controller.GetCallback() as RedirectResult;

        Assert.AreEqual("/device-oauth.html?code=c&state=web-123", result.Url);
    }

    [TestMethod]
    public void PostToken_ShouldRelayGarminsResponse()
    {
        _garminGateway.ExchangeCode("code", "verifier", "redirect").Returns(new GarminResponse(200, "{\"access_token\":\"a\"}"));

        var result = _controller.PostToken(new GarminCodeExchangeRequest { Code = "code", CodeVerifier = "verifier", RedirectUri = "redirect" }).Result as ContentResult;

        Assert.IsNotNull(result);
        Assert.AreEqual(200, result.StatusCode);
        Assert.AreEqual("{\"access_token\":\"a\"}", result.Content);
    }

    [TestMethod]
    public void PostRefresh_GarminRejects_ShouldRelayTheError()
    {
        _garminGateway.RefreshToken("refresh").Returns(new GarminResponse(400, "{}"));

        var result = _controller.PostRefresh(new GarminRefreshRequest { RefreshToken = "refresh" }).Result as ContentResult;

        Assert.IsNotNull(result);
        Assert.AreEqual(400, result.StatusCode);
    }

    [TestMethod]
    public void PostCourse_ShouldSendTheCourseAsIs()
    {
        var course = JsonDocument.Parse("{\"courseName\":\"name\"}").RootElement;
        _garminGateway.CreateCourse("token", Arg.Any<string>()).Returns(new GarminResponse(200, "{}"));

        _controller.PostCourse(new GarminCourseRequest { AccessToken = "token", Course = course }).Wait();

        _garminGateway.Received().CreateCourse("token", "{\"courseName\":\"name\"}");
    }

    [TestMethod]
    public void PostDisconnect_ShouldDeleteTheRegistration()
    {
        _garminGateway.DeleteRegistration("token").Returns(new GarminResponse(204, ""));

        var result = _controller.PostDisconnect(new GarminUserRequest { AccessToken = "token" }).Result as ContentResult;

        Assert.AreEqual(204, result.StatusCode);
        _garminGateway.Received().DeleteRegistration("token");
    }

    private void SetupQuery(string query)
    {
        _controller.ControllerContext = new ControllerContext { HttpContext = new DefaultHttpContext() };
        _controller.Request.QueryString = new QueryString(query);
    }
}
