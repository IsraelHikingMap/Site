using System;
using System.Collections.Generic;
using System.Linq;
using GeoAPI.Geometries;
using IsraelHiking.API.Services;
using IsraelHiking.Common;
using IsraelHiking.DataAccessInterfaces;
using IsraelTransverseMercator;
using Microsoft.VisualStudio.TestTools.UnitTesting;
using NetTopologySuite.Features;
using NetTopologySuite.Geometries;
using NSubstitute;

namespace IsraelHiking.API.Tests.Services
{
    [TestClass]
    public class AddibleGpxLinesFinderServiceTests
    {
        private IAddibleGpxLinesFinderService _service;
        private IGpxLoopsSplitterService _gpxLoopsSplitterService;
        private IElasticSearchGateway _elasticSearchGateway;
        private IConfigurationProvider _configurationProvider;

        [TestInitialize]
        public void TestInitialize()
        {
            _gpxLoopsSplitterService = Substitute.For<IGpxLoopsSplitterService>();
            _elasticSearchGateway = Substitute.For<IElasticSearchGateway>();
            _configurationProvider = Substitute.For<IConfigurationProvider>();
            _configurationProvider.MaxNumberOfPointsPerLine.Returns(5);
            _service = new AddibleGpxLinesFinderService(_gpxLoopsSplitterService, new CoordinatesConverter(), _elasticSearchGateway, _configurationProvider);
        }

        [TestMethod]
        public void GetLines_StraightLine_ShouldReturnAsIs()
        {
            var gpxLine = new LineString(new[] {new Coordinate(0, 0), new Coordinate(1, 1)});
            _configurationProvider.MaxNumberOfPointsPerLine.Returns(5);
            _elasticSearchGateway.GetHighways(Arg.Any<LatLng>(), Arg.Any<LatLng>()).Returns(new List<Feature>());
            _gpxLoopsSplitterService.GetMissingLines(Arg.Any<LineString>(), Arg.Any<IReadOnlyList<LineString>>(),
                Arg.Any<double>(), Arg.Any<double>()).Returns(new List<LineString> {gpxLine});
            _gpxLoopsSplitterService.SplitSelfLoops(Arg.Any<LineString>(), Arg.Any<double>())
                .Returns(new List<LineString> {gpxLine});

            var results = _service.GetLines(new List<LineString> {gpxLine}).Result;

            Assert.AreEqual(1, results.Count());
        }

        [TestMethod]
        public void GetLines_StraightLongLine_ShouldReturnSplitAndMerge()
        {
            var gpxLine = new LineString(new[]
            {
                new Coordinate(0, 0),
                new Coordinate(1, 1),
                new Coordinate(2, 2),
                new Coordinate(3, 3),
                new Coordinate(4, 4),
                new Coordinate(5, 5)
            });
            _configurationProvider.MaxNumberOfPointsPerLine.Returns(3);
            _elasticSearchGateway.GetHighways(Arg.Any<LatLng>(), Arg.Any<LatLng>()).Returns(new List<Feature>());
            _gpxLoopsSplitterService.GetMissingLines(Arg.Any<LineString>(), Arg.Any<IReadOnlyList<LineString>>(),
                Arg.Any<double>(), Arg.Any<double>()).Returns(x => new List<LineString> { x[0] as LineString});
            _gpxLoopsSplitterService.SplitSelfLoops(Arg.Any<LineString>(), Arg.Any<double>())
                .Returns(new List<LineString> { gpxLine });

            var results = _service.GetLines(new List<LineString> { gpxLine }).Result;

            Assert.AreEqual(1, results.Count());
        }
    }
}
