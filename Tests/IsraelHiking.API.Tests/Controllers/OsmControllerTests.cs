﻿using System;
using System.Collections.Generic;
using System.Collections.Immutable;
using System.Linq;
using GeoAPI.Geometries;
using IsraelHiking.API.Controllers;
using IsraelHiking.API.Executors;
using IsraelHiking.API.Gpx;
using IsraelHiking.API.Services;
using IsraelHiking.API.Services.Osm;
using IsraelHiking.Common;
using IsraelHiking.DataAccessInterfaces;
using Microsoft.VisualStudio.TestTools.UnitTesting;
using NetTopologySuite.Features;
using NetTopologySuite.Geometries;
using NSubstitute;
using Microsoft.Extensions.Options;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Logging;
using NetTopologySuite.IO;

namespace IsraelHiking.API.Tests.Controllers
{
    [TestClass]
    public class OsmControllerTests
    {
        private OsmController _controller;
        private IElasticSearchGateway _elasticSearchGateway;
        private IOsmLineAdderService _osmLineAdderService;
        private IHttpGatewayFactory _httpGatewayFactory;
        private IDataContainerConverterService _dataContainerConverterService;
        private IAddibleGpxLinesFinderService _addibleGpxLinesFinderService;
        private ConfigurationData _options;

        private string SetupGpxUrl(GpxMainObject gpx, List<LineString> addibleLines = null)
        {
            var url = "url";
            var fetcher = Substitute.For<IRemoteFileFetcherGateway>();
            var fileResponse = new RemoteFileFetcherGatewayResponse
            {
                FileName = url,
                Content = new byte[0]
            };
            fetcher.GetFileContent(url).Returns(fileResponse);
            _dataContainerConverterService.Convert(Arg.Any<byte[]>(), Arg.Any<string>(), Arg.Any<string>())
                .Returns(gpx.ToBytes());
            _httpGatewayFactory.CreateRemoteFileFetcherGateway(Arg.Any<TokenAndSecret>()).Returns(fetcher);
            _addibleGpxLinesFinderService.GetLines(Arg.Any<List<ILineString>>()).Returns(
                addibleLines ?? new List <LineString>
                {
                    new LineString(new[] {new Coordinate(0, 0), new Coordinate(1, 1)})
                }.AsEnumerable()
            );
            return url;
        }

        [TestInitialize]
        public void TestInitialize()
        {
            _httpGatewayFactory = Substitute.For<IHttpGatewayFactory>();
            _dataContainerConverterService = Substitute.For<IDataContainerConverterService>();
            _elasticSearchGateway = Substitute.For<IElasticSearchGateway>();
            _addibleGpxLinesFinderService = Substitute.For<IAddibleGpxLinesFinderService>();
            _osmLineAdderService = Substitute.For<IOsmLineAdderService>();
            _options = new ConfigurationData();
            var optionsProvider = Substitute.For<IOptions<ConfigurationData>>();
            optionsProvider.Value.Returns(_options);
            _controller = new OsmController(_httpGatewayFactory, _dataContainerConverterService, new ItmWgs84MathTransfromFactory(), 
                _elasticSearchGateway, _addibleGpxLinesFinderService, _osmLineAdderService, optionsProvider, GeometryFactory.Default,
                new LruCache<string, TokenAndSecret>(optionsProvider, Substitute.For<ILogger>()));
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
        public void GetClosestPoint_ShouldGetTheClosesOsmPoint()
        {
            var list = new List<Feature>
            {
                new Feature(new LineString(new Coordinate[0]), new AttributesTable
                {
                    {FeatureAttributes.POI_SOURCE, Sources.OSM}
                }),
                new Feature(new Point(new Coordinate(0, 0)), new AttributesTable
                {
                    {FeatureAttributes.POI_SOURCE, Sources.WIKIPEDIA}
                }),
                new Feature(new Point(new Coordinate(0.01, 0.01)), new AttributesTable
                {
                    {FeatureAttributes.POI_SOURCE, Sources.OSM}
                })
            };
            _elasticSearchGateway.GetPointsOfInterest(Arg.Any<Coordinate>(), Arg.Any<Coordinate>(), Arg.Any<string[]>(), Arg.Any<string>()).Returns(list);

            var results = _controller.GetClosestPoint("0,0").Result;

            Assert.AreEqual(list.Last(), results);
        }

        [TestMethod]
        public void GetConfiguration_ShouldReturnIt()
        {
            var osmConfiguration = new OsmConfiguraionData {BaseAddress = "baseAddress"};
            _options.OsmConfiguraion = osmConfiguration;

            var results = _controller.GetConfigurations();

            Assert.AreEqual(osmConfiguration.BaseAddress, results.BaseAddress);
        }

        [TestMethod]
        public void PutGpsTraceIntoOsm_ShouldDoIt()
        {
            var feature = new Feature(new LineString(new Coordinate[0]), new AttributesTable());
            _controller.SetupIdentity();

            _controller.PutGpsTraceIntoOsm(feature).Wait();

            _osmLineAdderService.Received(1).Add(Arg.Any<LineString>(), Arg.Any<Dictionary<string, string>>(), null);
        }

        [TestMethod]
        public void PostGpsTrace_NoFileOrUrlProvided_ShouldReturnBadRequestResult()
        {
            _controller.SetupIdentity();

            var results = _controller.PostGpsTrace(string.Empty).Result as BadRequestObjectResult;

            Assert.IsNotNull(results);
        }

        [TestMethod]
        public void PostGpsTrace_UrlProvidedForEmptyGpxFile_ShouldReturnEmptyFeatureCollection()
        {
            var url = SetupGpxUrl(new GpxMainObject(), new List<LineString>());
            _controller.SetupIdentity();

            var results = _controller.PostGpsTrace(url).Result as BadRequestObjectResult;

            Assert.IsNotNull(results);
        }

        [TestMethod]
        public void PostGpsTrace_UrlProvidedForSemiEmptyGpxFile_ShouldReturnEmptyFeatureCollection()
        {
            var url = SetupGpxUrl(new GpxMainObject
            {
                Tracks = new[]
                {
                    new GpxTrack(null, null, null, null, ImmutableArray<GpxWebLink>.Empty, null,
                        null, ImmutableArray<GpxTrackSegment>.Empty, null)
                }.ToList()
            }, new List<LineString>());
            _controller.SetupIdentity();

            var results = _controller.PostGpsTrace(url).Result as BadRequestObjectResult;

            Assert.IsNotNull(results);
        }

        [TestMethod]
        public void PostGpsTrace_FileProvidedForFootwayGpxFile_ShouldReturnFeatureCollection()
        {
            var gpx = new GpxMainObject
            {
                Routes = new List<GpxRoute>
                {
                    new GpxRoute(null, null, null, null, ImmutableArray<GpxWebLink>.Empty, null, null,
                        new ImmutableGpxWaypointTable(new[]
                        {
                            new GpxWaypoint(new GpxLongitude(0), new GpxLatitude(0), null, DateTime.Now.ToUniversalTime(), null, null,
                                null, null, null, null, null, ImmutableArray<GpxWebLink>.Empty, null, null, null, null,
                                null, null, null, null, null),
                            new GpxWaypoint(new GpxLongitude(0.00001), new GpxLatitude(0.00001), null,
                                DateTime.Now.AddMinutes(1).ToUniversalTime(), null, null, null, null, null, null, null,
                                ImmutableArray<GpxWebLink>.Empty, null, null, null, null, null, null, null, null, null),
                        }.ToImmutableArray()), null)
                },
                Tracks = new List<GpxTrack>
                {
                    new GpxTrack(null, null,null,null,ImmutableArray<GpxWebLink>.Empty, null,null, new []
                    {
                        new GpxTrackSegment(new ImmutableGpxWaypointTable(new []
                        {
                            new GpxWaypoint(new GpxLongitude(0.00002), new GpxLatitude(0.00002), null, DateTime.Now.AddMinutes(2).ToUniversalTime(), null, null,
                                null, null, null, null, null, ImmutableArray<GpxWebLink>.Empty, null, null, null, null,
                                null, null, null, null, null),
                            new GpxWaypoint(new GpxLongitude(0.00003), new GpxLatitude(0.00003), null,
                                DateTime.Now.AddMinutes(3).ToUniversalTime(), null, null, null, null, null, null, null,
                                ImmutableArray<GpxWebLink>.Empty, null, null, null, null, null, null, null, null, null),
                        }), null)
                    }.ToImmutableArray(), null)
                }
            };
            var fetcher = Substitute.For<IRemoteFileFetcherGateway>();
            var file = Substitute.For<IFormFile>();
            file.FileName.Returns("SomeFile.gpx");
            _dataContainerConverterService.Convert(Arg.Any<byte[]>(), Arg.Any<string>(), Arg.Any<string>()).Returns(gpx.ToBytes());
            _httpGatewayFactory.CreateRemoteFileFetcherGateway(Arg.Any<TokenAndSecret>()).Returns(fetcher);
            _addibleGpxLinesFinderService.GetLines(Arg.Any<List<ILineString>>()).Returns(
                new List<LineString>
                {
                    new LineString(new[] {new Coordinate(0, 0), new Coordinate(1, 1)})
                }.AsEnumerable()
            );
            _controller.SetupIdentity();

            var results = _controller.PostGpsTrace(null, file).Result as OkObjectResult;

            Assert.IsNotNull(results);
            var featureCollection = results.Value as FeatureCollection;
            Assert.IsNotNull(featureCollection);
            Assert.AreEqual(1, featureCollection.Features.Count);
            Assert.IsTrue(featureCollection.Features.First().Attributes.GetValues().Contains("footway"));
        }

        [TestMethod]
        public void PostGpsTrace_UrlProvidedForCyclewayGpxFile_ShouldReturnFeatureCollection()
        {
            var gpx = new GpxMainObject
            {
                Routes = new[]
                {
                    new GpxRoute(null, null, null, null, ImmutableArray<GpxWebLink>.Empty, null, null,
                        new ImmutableGpxWaypointTable(new[]
                        {
                            new GpxWaypoint(new GpxLongitude(0), new GpxLatitude(0), null, DateTime.Now.ToUniversalTime(), null, null,
                                null, null, null, null, null, ImmutableArray<GpxWebLink>.Empty, null, null, null, null,
                                null, null, null, null, null),
                            new GpxWaypoint(new GpxLongitude(0.001), new GpxLatitude(0.001), null,
                                DateTime.Now.AddMinutes(1).ToUniversalTime(), null, null, null, null, null, null, null,
                                ImmutableArray<GpxWebLink>.Empty, null, null, null, null, null, null, null, null, null),
                        }.ToImmutableArray()), null)
                }.ToList()
            };
            var url = SetupGpxUrl(gpx);
            _controller.SetupIdentity();

            var results = _controller.PostGpsTrace(url).Result as OkObjectResult;

            Assert.IsNotNull(results);
            var featureCollection = results.Value as FeatureCollection;
            Assert.IsNotNull(featureCollection);
            Assert.AreEqual(1, featureCollection.Features.Count);
            Assert.IsTrue(featureCollection.Features.First().Attributes.GetValues().Contains("cycleway"));
        }

        [TestMethod]
        public void PostGpsTrace_UrlProvidedForTrackGpxFile_ShouldReturnFeatureCollection()
        {
            var gpx = new GpxMainObject
            {
                Routes = new[]
                {
                    new GpxRoute(null, null, null, null, ImmutableArray<GpxWebLink>.Empty, null, null,
                        new ImmutableGpxWaypointTable(new[]
                        {
                            new GpxWaypoint(new GpxLongitude(0), new GpxLatitude(0), null, DateTime.Now.ToUniversalTime(), null, null,
                                null, null, null, null, null, ImmutableArray<GpxWebLink>.Empty, null, null, null, null,
                                null, null, null, null, null),
                            new GpxWaypoint(new GpxLongitude(0.01), new GpxLatitude(0.01), null,
                                DateTime.Now.AddMinutes(1).ToUniversalTime(), null, null, null, null, null, null, null,
                                ImmutableArray<GpxWebLink>.Empty, null, null, null, null, null, null, null, null, null),
                        }.ToImmutableArray()), null)
                }.ToList()
            };
            var url = SetupGpxUrl(gpx);
            _controller.SetupIdentity();

            var results = _controller.PostGpsTrace(url).Result as OkObjectResult;

            Assert.IsNotNull(results);
            var featureCollection = results.Value as FeatureCollection;
            Assert.IsNotNull(featureCollection);
            Assert.AreEqual(1, featureCollection.Features.Count);
            Assert.IsTrue(featureCollection.Features.First().Attributes.GetValues().Contains("track"));
        }
    }
}
