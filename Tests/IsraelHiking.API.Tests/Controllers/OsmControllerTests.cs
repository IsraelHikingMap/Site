using GeoAPI.Geometries;
using IsraelHiking.API.Controllers;
using IsraelHiking.API.Executors;
using IsraelHiking.API.Gpx;
using IsraelHiking.API.Services;
using IsraelHiking.API.Services.Osm;
using IsraelHiking.Common;
using IsraelHiking.DataAccessInterfaces;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using Microsoft.VisualStudio.TestTools.UnitTesting;
using NetTopologySuite.Features;
using NetTopologySuite.Geometries;
using NetTopologySuite.IO;
using NSubstitute;
using OsmSharp.IO.API;
using System;
using System.Collections.Generic;
using System.Collections.Immutable;
using System.IO;
using System.Linq;

namespace IsraelHiking.API.Tests.Controllers
{
    [TestClass]
    public class OsmControllerTests
    {
        private OsmController _controller;
        private IElasticSearchGateway _elasticSearchGateway;
        private IOsmLineAdderService _osmLineAdderService;
        private IClientsFactory _clientsFactory;
        private IDataContainerConverterService _dataContainerConverterService;
        private IAddibleGpxLinesFinderService _addibleGpxLinesFinderService;
        private ConfigurationData _options;
        private LruCache<string, TokenAndSecret> _cache;

        private int SetupGpxUrl(GpxFile gpx, List<LineString> addibleLines = null)
        {
            int traceId = 1;
            var fetcher = Substitute.For<IAuthClient>();
            var fileResponse = new TypedStream
            {
                FileName = "file.gpx",
                Stream = new MemoryStream(new byte[0])
            };
            fetcher.GetTraceData(traceId).Returns(fileResponse);
            _dataContainerConverterService.Convert(Arg.Any<byte[]>(), Arg.Any<string>(), Arg.Any<string>())
                .Returns(gpx.ToBytes());
            _clientsFactory.CreateOAuthClient(Arg.Any<string>(), Arg.Any<string>(), Arg.Any<string>(), Arg.Any<string>()).Returns(fetcher);
            _addibleGpxLinesFinderService.GetLines(Arg.Any<List<LineString>>()).Returns(
                addibleLines ?? new List <LineString>
                {
                    new LineString(new[] {new Coordinate(0, 0), new Coordinate(1, 1)})
                }.AsEnumerable()
            );
            return traceId;
        }

        [TestInitialize]
        public void TestInitialize()
        {
            _clientsFactory = Substitute.For<IClientsFactory>();
            _dataContainerConverterService = Substitute.For<IDataContainerConverterService>();
            _elasticSearchGateway = Substitute.For<IElasticSearchGateway>();
            _addibleGpxLinesFinderService = Substitute.For<IAddibleGpxLinesFinderService>();
            _osmLineAdderService = Substitute.For<IOsmLineAdderService>();
            _options = new ConfigurationData();
            var optionsProvider = Substitute.For<IOptions<ConfigurationData>>();
            optionsProvider.Value.Returns(_options);
            _cache = new LruCache<string, TokenAndSecret>(optionsProvider, Substitute.For<ILogger>());
            _controller = new OsmController(_clientsFactory, _dataContainerConverterService, new ItmWgs84MathTransfromFactory(), 
                _elasticSearchGateway, _addibleGpxLinesFinderService, _osmLineAdderService, optionsProvider, new GeometryFactory(),
                _cache);
        }

        [TestMethod]
        public void GetSnappings_ShouldGetSome()
        {
            var list = new List<Feature> { new Feature(new LineString(new Coordinate[0]), new AttributesTable())};
            _elasticSearchGateway.GetHighways(Arg.Any<Coordinate>(), Arg.Any<Coordinate>()).Returns(list);
            _elasticSearchGateway.GetPointsOfInterest(Arg.Any<Coordinate>(), Arg.Any<Coordinate>(), Arg.Any<string[]>(), Arg.Any<string>()).Returns(new List<Feature>());

            var results = _controller.GetSnappings("0,0", "1,1").Result;

            Assert.AreEqual(list.Count, results.Count);
        }

        [TestMethod]
        public void GetConfiguration_ShouldReturnIt()
        {
            var osmConfiguration = new OsmConfiguraionData {BaseAddress = "baseAddress"};
            _options.OsmConfiguration = osmConfiguration;

            var results = _controller.GetConfigurations();

            Assert.AreEqual(osmConfiguration.BaseAddress, results.BaseAddress);
        }

        [TestMethod]
        public void PutGpsTraceIntoOsm_ShouldDoIt()
        {
            var feature = new Feature(new LineString(new Coordinate[0]), new AttributesTable());
            _controller.SetupIdentity(_cache);

            _controller.PutGpsTraceIntoOsm(feature).Wait();

            _osmLineAdderService.Received(1).Add(Arg.Any<LineString>(), Arg.Any<Dictionary<string, string>>(), Arg.Any<TokenAndSecret>());
        }

        [TestMethod]
        public void PostGpsTrace_NoFileOrUrlProvided_ShouldReturnBadRequestResult()
        {
            _controller.SetupIdentity(_cache);
            var fetcher = Substitute.For<IAuthClient>();
            fetcher.GetTraceData(Arg.Any<int>()).Returns((TypedStream)null);
            _clientsFactory.CreateOAuthClient(Arg.Any<string>(), Arg.Any<string>(), Arg.Any<string>(), Arg.Any<string>()).Returns(fetcher);

            var results = _controller.PostFindUnmappedPartsFromGpsTrace(-1).Result as BadRequestObjectResult;

            Assert.IsNotNull(results);
        }

        [TestMethod]
        public void PostGpsTrace_UrlProvidedForEmptyGpxFile_ShouldReturnEmptyFeatureCollection()
        {
            var url = SetupGpxUrl(new GpxFile(), new List<LineString>());
            _controller.SetupIdentity(_cache);

            var results = _controller.PostFindUnmappedPartsFromGpsTrace(url).Result as BadRequestObjectResult;

            Assert.IsNotNull(results);
        }

        [TestMethod]
        public void PostGpsTrace_UrlProvidedForSemiEmptyGpxFile_ShouldReturnEmptyFeatureCollection()
        {
            var gpx = new GpxFile();
            gpx.Tracks.Add(new GpxTrack());
            var url = SetupGpxUrl(gpx, new List<LineString>());
            _controller.SetupIdentity(_cache);

            var results = _controller.PostFindUnmappedPartsFromGpsTrace(url).Result as BadRequestObjectResult;

            Assert.IsNotNull(results);
        }

        [TestMethod]
        public void PostGpsTrace_UrlProvidedForCyclewayGpxFile_ShouldReturnFeatureCollection()
        {
            var gpx = new GpxFile();
            gpx.Routes.Add(
                new GpxRoute().WithWaypoints(new[]
                {
                    new GpxWaypoint((GpxLongitude) 0, (GpxLatitude) 0).WithTimestampUtc(DateTime.Now.ToUniversalTime()),
                    new GpxWaypoint((GpxLongitude) 0.001, (GpxLatitude) 0.001).WithTimestampUtc(DateTime.Now
                        .AddMinutes(1).ToUniversalTime())
                }));
            var url = SetupGpxUrl(gpx);
            _controller.SetupIdentity(_cache);

            var results = _controller.PostFindUnmappedPartsFromGpsTrace(url).Result as OkObjectResult;

            Assert.IsNotNull(results);
            var featureCollection = results.Value as FeatureCollection;
            Assert.IsNotNull(featureCollection);
            Assert.AreEqual(1, featureCollection.Count);
            Assert.IsTrue(featureCollection.Features.First().Attributes.GetValues().Contains("cycleway"));
        }

        [TestMethod]
        public void PostGpsTrace_UrlProvidedForTrackGpxFile_ShouldReturnFeatureCollection()
        {
            var gpx = new GpxFile();
            gpx.Routes.Add(
                new GpxRoute().WithWaypoints(new[]
                {
                    new GpxWaypoint(new GpxLongitude(0), new GpxLatitude(0)).WithTimestampUtc(
                        DateTime.Now.ToUniversalTime()),
                    new GpxWaypoint(new GpxLongitude(0.01), new GpxLatitude(0.01)).WithTimestampUtc(DateTime.Now
                        .AddMinutes(1).ToUniversalTime())
                })
            );
            var url = SetupGpxUrl(gpx);
            _controller.SetupIdentity(_cache);

            var results = _controller.PostFindUnmappedPartsFromGpsTrace(url).Result as OkObjectResult;

            Assert.IsNotNull(results);
            var featureCollection = results.Value as FeatureCollection;
            Assert.IsNotNull(featureCollection);
            Assert.AreEqual(1, featureCollection.Count);
            Assert.IsTrue(featureCollection.Features.First().Attributes.GetValues().Contains("track"));
        }
    }
}
