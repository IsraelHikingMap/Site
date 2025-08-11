using System;
using System.IO;
using System.Text;
using IsraelHiking.API.Services;
using IsraelHiking.API.Services.Middleware;
using IsraelHiking.API.Services.Poi;
using IsraelHiking.Common;
using IsraelHiking.Common.Configuration;
using IsraelHiking.DataAccessInterfaces;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.Options;
using Microsoft.VisualStudio.TestTools.UnitTesting;
using NetTopologySuite.Features;
using NetTopologySuite.Geometries;
using NSubstitute;
using Wangkanai.Detection.Services;

namespace IsraelHiking.API.Tests.Services.Middleware;

[TestClass]
public class CrawlersMiddlewareTests
{
    private CrawlersMiddleware _middleware;
    private IServiceProvider _serviceProvider;
    private IShareUrlGateway _shareUrlGateway;
    private IPointsOfInterestProvider _pointsOfInterestProvider;
    private IHomePageHelper _homePageHelper;
    private RequestDelegate _next;

    [TestInitialize]
    public void TestInitialize()
    {
        _next = Substitute.For<RequestDelegate>();
        _serviceProvider = Substitute.For<IServiceProvider>();
        _shareUrlGateway = Substitute.For<IShareUrlGateway>();
        _pointsOfInterestProvider = Substitute.For<IPointsOfInterestProvider>();
        _homePageHelper = Substitute.For<IHomePageHelper>();
        var config = new ConfigurationData();
        var options = Substitute.For<IOptions<ConfigurationData>>();
        options.Value.Returns(config);
        _middleware = new CrawlersMiddleware(_next, _homePageHelper, _shareUrlGateway,
            _pointsOfInterestProvider);
    }

    private IDetectionService SetupDetectionService()
    {
        var detectionService = Substitute.For<IDetectionService>();
        var crawlerService = Substitute.For<ICrawlerService>();
        crawlerService.IsCrawler.Returns(true);
        crawlerService.Name.Returns(Wangkanai.Detection.Models.Crawler.WhatsApp);
        detectionService.Crawler.Returns(crawlerService);
        _serviceProvider.GetService(typeof(IDetectionService)).Returns(detectionService);
        return detectionService;
    }

    [TestMethod]
    public void TestAPI_ShouldPassThrough()
    {
        var context = new DefaultHttpContext
        {
            Request =
            {
                Path = new PathString("/api/something"),
                Host = new HostString("www.example.com"),
                QueryString = QueryString.Empty,
                PathBase = PathString.Empty,
                Scheme = "http"
            }
        };

        _middleware.InvokeAsync(context, null).Wait();

        _next.Received().Invoke(context);
    }
        
    [TestMethod]
    public void TestNonCrawler_ShouldPassThrough()
    {
        var context = new DefaultHttpContext
        {
            Request =
            {
                Path = new PathString("/share"),
                Host = new HostString("www.example.com"),
                QueryString = QueryString.Empty,
                PathBase = PathString.Empty,
                Scheme = "http"
            }
        };

        var detectionService = Substitute.For<IDetectionService>();
        var crawlerService = Substitute.For<ICrawlerService>();
        crawlerService.IsCrawler.Returns(false);
        detectionService.Crawler.Returns(crawlerService);
        _serviceProvider.GetService(typeof(IDetectionService)).Returns(detectionService);

        _middleware.InvokeAsync(context, detectionService).Wait();

        _next.Received().Invoke(context);
    }
        
    [TestMethod]
    public void TestCrawler_NotExpected_ShouldPassThrough()
    {
        var context = new DefaultHttpContext
        {
            Request =
            {
                Path = new PathString($"/somthing")
            }
        };
        var detectionService = SetupDetectionService();

        _middleware.InvokeAsync(context, detectionService).Wait();

        _next.Received().Invoke(context);
    }
        
    [TestMethod]
    public void TestCrawler_Poi()
    {
        const string source = "source";
        const string id = "id";
        var context = new DefaultHttpContext();
        using var stream = new MemoryStream();
        context.Response.Body = stream;
        context.Request.Path = new PathString($"/poi/{source}/{id}");

        const string name = "name";
        const string description = "description";
        const string url = "https://upload.wikimedia.org/wikipedia/commons/6/66/Israel_Hiking_Map_%D7%A2%D7%99%D7%9F_%D7%A0%D7%98%D7%A3.jpeg";
            
        _pointsOfInterestProvider.GetFeatureById(source, id).Returns(new Feature(new Point(0, 0),
            new AttributesTable
            {
                { FeatureAttributes.NAME, name },
                { FeatureAttributes.DESCRIPTION, description },
                { FeatureAttributes.IMAGE_URL, url }
            }));
        var detectionService = SetupDetectionService();
        _homePageHelper.Render(name, description, Arg.Any<string>(), Languages.HEBREW).Returns("OUT");

        _middleware.InvokeAsync(context, detectionService).Wait();

        var bodyString = Encoding.UTF8.GetString(stream.ToArray());
        Assert.AreEqual("OUT", bodyString);
        _next.DidNotReceive().Invoke(context);
    }
        
    [TestMethod]
    public void TestCrawler_NotExistingPoi_ShouldCallNext()
    {
        const string source = "source";
        const string id = "id";
        var context = new DefaultHttpContext
        {
            Request =
            {
                Path = new PathString($"/poi/{source}/{id}")
            }
        };
        var detectionService = SetupDetectionService();
        _pointsOfInterestProvider.GetFeatureById(Arg.Any<string>(), Arg.Any<string>()).Returns(null as IFeature);
            
        _middleware.InvokeAsync(context, detectionService).Wait();
            
        _homePageHelper.DidNotReceive().Render(Arg.Any<string>(), Arg.Any<string>(), Arg.Any<string>(), Arg.Any<string>());
        _next.Received().Invoke(context);
    }
        
    [TestMethod]
    public void TestCrawler_PoiWithExternalDescription_ShouldReturnExternal()
    {
        const string source = "source";
        const string id = "id";
        var context = new DefaultHttpContext();
        var stream = new MemoryStream();
        context.Response.Body = stream;
        context.Request.Path = new PathString($"/poi/{source}/{id}");

        const string name = "Jabel Wadi";
        const string externalDescription = "This feature only has an external description";
        const string url = "https://upload.wikimedia.org/wikipedia/commons/6/66/Israel_Hiking_Map_%D7%A2%D7%99%D7%9F_%D7%A0%D7%98%D7%A3.jpeg";
            
        _pointsOfInterestProvider.GetFeatureById(source, id).Returns(new Feature(new Point(0, 0),
            new AttributesTable
            {
                { FeatureAttributes.NAME, name },
                { FeatureAttributes.POI_EXTERNAL_DESCRIPTION, externalDescription },
                { FeatureAttributes.IMAGE_URL, url }
            }));
        var detectionService = SetupDetectionService();

        _middleware.InvokeAsync(context, detectionService).Wait();

        _homePageHelper.Received().Render(name, externalDescription, Arg.Any<string>(), Languages.HEBREW);
        _next.DidNotReceive().Invoke(context);
    }

    [TestMethod]
    public void TestCrawler_NonExistingShare()
    {
        const string id = "id";
        var context = new DefaultHttpContext();
        var stream = new MemoryStream();
        context.Response.Body = stream;
        context.Request.Path = new PathString($"/share/{id}");
        context.Request.Host = new HostString("www.example.com");
        context.Request.QueryString = QueryString.Empty;
        context.Request.PathBase = PathString.Empty;
        context.Request.Scheme = "http";
        _shareUrlGateway.GetUrlById(id).Returns((ShareUrl)null);
        var detectionService = SetupDetectionService();

        _middleware.InvokeAsync(context, detectionService).Wait();

        _next.Received().Invoke(context);
        _homePageHelper.DidNotReceive().Render(Arg.Any<string>(), Arg.Any<string>(), Arg.Any<string>(), Arg.Any<string>());
    }
        
    [TestMethod]
    public void TestCrawler_Share()
    {
        const string id = "id";
        var context = new DefaultHttpContext();
        var stream = new MemoryStream();
        context.Response.Body = stream;
        context.Request.Path = new PathString($"/share/{id}");
        context.Request.Host = new HostString("www.example.com");
        context.Request.QueryString = QueryString.Empty;
        context.Request.PathBase = PathString.Empty;
        context.Request.Scheme = "http";
        var shareUrl = new ShareUrl
        {
            Id = id,
            Title = "title",
            Description = "desc",
        };
        _shareUrlGateway.GetUrlById(id).Returns(shareUrl);
        var detectionService = SetupDetectionService();

        _middleware.InvokeAsync(context, detectionService).Wait();

        var checkUrl = Arg.Is<string>(x => x.EndsWith(shareUrl.Id + "?width=256&height=256"));
        _homePageHelper.Received().Render(shareUrl.Title, shareUrl.Description, checkUrl);
        _next.DidNotReceive().Invoke(context);
    }
}