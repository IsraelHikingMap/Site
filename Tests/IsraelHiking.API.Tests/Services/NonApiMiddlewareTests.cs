using IsraelHiking.API.Services;
using IsraelHiking.API.Services.Poi;
using IsraelHiking.Common;
using IsraelHiking.Common.Configuration;
using IsraelHiking.DataAccessInterfaces.Repositories;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.Options;
using Microsoft.VisualStudio.TestTools.UnitTesting;
using NetTopologySuite.Features;
using NetTopologySuite.Geometries;
using NSubstitute;
using System;
using System.IO;
using System.Text;
using NSubstitute.Extensions;
using Wangkanai.Detection.Services;

namespace IsraelHiking.API.Tests.Services
{
    [TestClass]
    public class NonApiMiddlewareTests : HomePageHelperFixture
    {
        private NonApiMiddleware _middleware;
        private IWebHostEnvironment _hostingEnvironment;
        private IServiceProvider _serviceProvider;
        private IShareUrlsRepository _repository;
        private IPointsOfInterestProvider _pointsOfInterestProvider;

        [TestInitialize]
        public void TestInitialize()
        {
            _hostingEnvironment = Substitute.For<IWebHostEnvironment>();
            _serviceProvider = Substitute.For<IServiceProvider>();
            _repository = Substitute.For<IShareUrlsRepository>();
            _pointsOfInterestProvider = Substitute.For<IPointsOfInterestProvider>();
            setUpHomePageHelper();
            var config = new ConfigurationData();
            var options = Substitute.For<IOptions<ConfigurationData>>();
            options.Value.Returns(config);
            _middleware = new NonApiMiddleware(null, _hostingEnvironment, _homePageHelper, _repository,
                _pointsOfInterestProvider, options);
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
        public void TestCrawler_Poi()
        {
            var source = "source";
            var id = "id";
            var context = new DefaultHttpContext();
            var stream = new MemoryStream();
            context.Response.Body = stream;
            context.Request.Path = new PathString($"/poi/{source}/{id}");

            var name = "Jabel Wadi";
            var desc = "Why not put small sign yam?";
            var url =
                "https://upload.wikimedia.org/wikipedia/commons/6/66/Israel_Hiking_Map_%D7%A2%D7%99%D7%9F_%D7%A0%D7%98%D7%A3.jpeg";
            
            _pointsOfInterestProvider.GetFeatureById(source, id).Returns(new Feature(new Point(0, 0),
                new AttributesTable
                {
                    { FeatureAttributes.NAME, name },
                    { FeatureAttributes.DESCRIPTION, desc },
                    { FeatureAttributes.IMAGE_URL, url }
                }));
            var detectionService = SetupDetectionService();

            _middleware.InvokeAsync(context, detectionService).Wait();

            var checkUrl = Arg.Is<string>(x => x.Contains("200px-"));
            _homePageHelper.Received().Render(name, desc, checkUrl, "he");
            
            var bodyString = Encoding.UTF8.GetString(stream.ToArray());
            Assert.AreEqual(output, bodyString);
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
            var shareUrl = new ShareUrl
            {
                Id = "xyzzy",
                Title = "title",
                Description = "desc",
            };
            _repository.GetUrlById(id).Returns(shareUrl);
            var detectionService = SetupDetectionService();

            _middleware.InvokeAsync(context, detectionService).Wait();

            var checkUrl = Arg.Is<string>(x => x.EndsWith(shareUrl.Id + "?width=256&height=256"));
            _homePageHelper.Received().Render(shareUrl.Title, shareUrl.Description, checkUrl);

            var bodyString = Encoding.UTF8.GetString(stream.ToArray());
            Assert.AreEqual(output, bodyString);
            
        }
    }
}