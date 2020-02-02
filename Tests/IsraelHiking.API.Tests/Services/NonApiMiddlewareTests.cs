using IsraelHiking.API.Services;
using IsraelHiking.API.Services.Poi;
using IsraelHiking.Common;
using IsraelHiking.Common.Poi;
using IsraelHiking.DataAccessInterfaces;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.Options;
using Microsoft.VisualStudio.TestTools.UnitTesting;
using NSubstitute;
using System;
using System.IO;
using System.Text;
using Wangkanai.Detection.Services;

namespace IsraelHiking.API.Tests.Services
{
    [TestClass]
    public class NonApiMiddlewareTests
    {
        private NonApiMiddleware _middleware;
        private IWebHostEnvironment _hostingEnvironment;
        private IServiceProvider _serviceProvider;
        private IRepository _repository;
        private IPointsOfInterestProvider _pointsOfInterestProvider;

        [TestInitialize]
        public void TestInitialize()
        {
            _hostingEnvironment = Substitute.For<IWebHostEnvironment>();
            _serviceProvider = Substitute.For<IServiceProvider>();
            _repository = Substitute.For<IRepository>();
            _pointsOfInterestProvider = Substitute.For<IPointsOfInterestProvider>();
            var config = new ConfigurationData();
            var options = Substitute.For<IOptions<ConfigurationData>>();
            options.Value.Returns(config);
            _middleware = new NonApiMiddleware(null, _hostingEnvironment, _repository, _pointsOfInterestProvider, options);
        }

        private IDetectionService SetupDetectionService()
        {
            var detectionService = Substitute.For<IDetectionService>();
            var crawlerService = Substitute.For<ICrawlerService>();
            crawlerService.IsCrawler.Returns(true);
            crawlerService.Type.Returns(Wangkanai.Detection.Models.Crawler.WhatsApp);
            detectionService.Crawler.Returns(crawlerService);
            _serviceProvider.GetService(typeof(IDetectionService)).Returns(detectionService);
            return detectionService;
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
            _pointsOfInterestProvider.GetPointOfInterestById(source, id, null).Returns(new PointOfInterestExtended
            {
                ImagesUrls = new [] { "https://upload.wikimedia.org/wikipedia/commons/archive/1/17/Israel_Hiking_Map.jpeg" }
            });
            var detectionService = SetupDetectionService();

            _middleware.InvokeAsync(context, detectionService).Wait();
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
            var detectionService = SetupDetectionService();

            _middleware.InvokeAsync(context, detectionService).Wait();
            var bodyString = Encoding.UTF8.GetString(stream.ToArray());

            Assert.IsTrue(bodyString.Contains("?width=256&height=256"));
        }
    }
}
