using System;
using System.IO;
using System.Text;
using IsraelHiking.API.Services;
using IsraelHiking.API.Services.Poi;
using IsraelHiking.Common;
using IsraelHiking.DataAccessInterfaces;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Options;
using Microsoft.VisualStudio.TestTools.UnitTesting;
using NSubstitute;
using NSubstitute.ReturnsExtensions;
using Wangkanai.Detection;

namespace IsraelHiking.API.Tests.Services
{
    [TestClass]
    public class NonApiMiddlewareTests
    {
        private NonApiMiddleware _middleware;
        private IHostingEnvironment _hostingEnvironment;
        private IServiceProvider _serviceProvider;
        private IRepository _repository;
        private IPointsOfInterestAggregatorService _pointsOfInterestAggregatorService;

        [TestInitialize]
        public void TestInitialize()
        {
            _hostingEnvironment = Substitute.For<IHostingEnvironment>();
            _serviceProvider = Substitute.For<IServiceProvider>();
            var browserResolver = Substitute.For<IBrowserResolver>();
            var browser = Substitute.For<IBrowser>();
            browser.Type.Returns(BrowserType.Generic);
            browserResolver.Browser.Returns(browser);
            var userAgentService = Substitute.For<IUserAgentService>();
            var userAgent = Substitute.For<IUserAgent>();
            userAgent.ToString().Returns("WhatsApp1.2.3");
            userAgentService.UserAgent.Returns(userAgent);
            _serviceProvider.GetService(typeof(IBrowserResolver)).Returns(browserResolver);
            _serviceProvider.GetService(typeof(IUserAgentService)).Returns(userAgentService);
            _repository = Substitute.For<IRepository>();
            _pointsOfInterestAggregatorService = Substitute.For<IPointsOfInterestAggregatorService>();
            var config = new ConfigurationData();
            var options = Substitute.For<IOptions<ConfigurationData>>();
            options.Value.Returns(config);
            _middleware = new NonApiMiddleware(null, _hostingEnvironment, _serviceProvider, _repository, _pointsOfInterestAggregatorService, options);
        }

        [TestMethod]
        public void TestCrawler_Poi()
        {
            var source = "source";
            var id = "id";
            var context = new DefaultHttpContext();
            var stream = new MemoryStream();
            context.Response.Body = stream;
            context.Request.Path = new PathString($"/poi/{source}/{id}");
            _pointsOfInterestAggregatorService.Get(source, id, null).Returns(new PointOfInterestExtended
            {
                ImagesUrls = new [] { "https://upload.wikimedia.org/wikipedia/commons/archive/1/17/Israel_Hiking_Map.jpeg" }
            });

            _middleware.InvokeAsync(context).Wait();
            var bodyString = Encoding.UTF8.GetString(stream.ToArray());

            Assert.IsTrue(bodyString.Contains("200px"));
        }

        [TestMethod]
        public void TestCrawler_Share()
        {
            var id = "id";
            var context = new DefaultHttpContext();
            var stream = new MemoryStream();
            context.Response.Body = stream;
            context.Request.Path = new PathString($"/share/{id}");
            context.Request.Host = new HostString("israelhiking.osm.org.il");
            context.Request.QueryString = QueryString.Empty;
            context.Request.PathBase = PathString.Empty;
            context.Request.Scheme = "http";
            _repository.GetUrlById(id).Returns(new ShareUrl());

            _middleware.InvokeAsync(context).Wait();
            var bodyString = Encoding.UTF8.GetString(stream.ToArray());

            Assert.IsTrue(bodyString.Contains("?width=128&height=128"));
        }
    }
}
