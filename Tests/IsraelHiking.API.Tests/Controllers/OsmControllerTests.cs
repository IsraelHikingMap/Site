using System.Collections.Generic;
using System.Net.Http;
using System.Threading.Tasks;
using System.Web.Http.Results;
using GeoAPI.Geometries;
using IsraelHiking.API.Controllers;
using IsraelHiking.API.Gpx;
using IsraelHiking.API.Gpx.GpxTypes;
using IsraelHiking.API.Services;
using IsraelHiking.API.Services.Osm;
using IsraelHiking.Common;
using IsraelHiking.DataAccessInterfaces;
using IsraelTransverseMercator;
using Microsoft.VisualStudio.TestTools.UnitTesting;
using NetTopologySuite.Features;
using NetTopologySuite.Geometries;
using NSubstitute;

namespace IsraelHiking.API.Tests.Controllers
{
    [TestClass]
    public class OsmControllerTests
    {
        private OsmController _controller;
        private IElasticSearchGateway _elasticSearchGateway;
        private IConfigurationProvider _configurationProvider;
        private IOsmLineAdderService _osmLineAdderService;
        private IHttpGatewayFactory _httpGatewayFactory;
        private IDataContainerConverterService _dataContainerConverterService;

        [TestInitialize]
        public void TestInitialize()
        {
            _httpGatewayFactory = Substitute.For<IHttpGatewayFactory>();
            _dataContainerConverterService = Substitute.For<IDataContainerConverterService>();
            var coordinatesConverter = Substitute.For<ICoordinatesConverter>();
            _elasticSearchGateway = Substitute.For<IElasticSearchGateway>();
            var addibleGpxLinesFinderService = Substitute.For<IAddibleGpxLinesFinderService>();
            _osmLineAdderService = Substitute.For<IOsmLineAdderService>();
            _configurationProvider = Substitute.For<IConfigurationProvider>();
            _controller = new OsmController(_httpGatewayFactory, _dataContainerConverterService, coordinatesConverter,
                _elasticSearchGateway, addibleGpxLinesFinderService, _osmLineAdderService, _configurationProvider,
                new LruCache<string, TokenAndSecret>(_configurationProvider));
        }

        [TestMethod]
        public void GetHighway_ShouldGetSome()
        {
            var list = new List<Feature> { new Feature(new LineString(new Coordinate[0]), new AttributesTable())};
            _elasticSearchGateway.GetHighways(Arg.Any<LatLng>(), Arg.Any<LatLng>()).Returns(Task.FromResult(list));

            var results = _controller.GetHighways("0,0", "1,1").Result;

            Assert.AreEqual(list.Count, results.Count);
        }

        [TestMethod]
        public void GetConfiguration_ShouldReturnIt()
        {
            var osmConfiguration = new OsmConfiguraionData {BaseAddress = "baseAddress"};
            _configurationProvider.OsmConfiguraion.Returns(osmConfiguration);

            var results = _controller.GetConfigurations();

            Assert.AreEqual(osmConfiguration.BaseAddress, results.BaseAddress);
        }

        [TestMethod]
        public void PutGpsTraceIntoOsm_ShouldDoIt()
        {
            var feature = new Feature(new LineString(new Coordinate[0]), new AttributesTable());

            _controller.PutGpsTraceIntoOsm(feature).Wait();

            _osmLineAdderService.Received(1).Add(Arg.Any<LineString>(), Arg.Any<Dictionary<string, string>>(), null);
        }

        [TestMethod]
        public void PostGpsTrace_NoFileOrUrlProvided_ShouldReturnBadRequestResult()
        {
            var multipartContent = new MultipartContent();
            _controller.Request = new HttpRequestMessage {Content = multipartContent};

            var results = _controller.PostGpsTrace(string.Empty).Result as BadRequestErrorMessageResult;

            Assert.IsNotNull(results);
        }

        [TestMethod]
        public void PostGpsTrace_UrlProvidedForEmptyGpxFile_ShouldReturnEmptyFeatureCollection()
        {
            var url = "url";
            var fetcher = Substitute.For<IRemoteFileFetcherGateway>();
            var fileResponse = new RemoteFileFetcherGatewayResponse
            {
                FileName = url,
                Content = new byte[0]
            };
            fetcher.GetFileContent(url).Returns(Task.FromResult(fileResponse));
            _dataContainerConverterService.Convert(Arg.Any<byte[]>(), Arg.Any<string>(), Arg.Any<string>()).Returns(new gpxType().ToBytes());
            _httpGatewayFactory.CreateRemoteFileFetcherGateway(Arg.Any<TokenAndSecret>()).Returns(fetcher);

            var results = _controller.PostGpsTrace(url).Result as OkNegotiatedContentResult<FeatureCollection>;

            Assert.IsNotNull(results);
            Assert.AreEqual(0, results.Content.Features.Count);
        }
    }
}
