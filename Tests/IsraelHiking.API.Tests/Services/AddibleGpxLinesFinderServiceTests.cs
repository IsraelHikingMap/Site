using IsraelHiking.API.Executors;
using IsraelHiking.API.Services;
using IsraelHiking.Common;
using IsraelHiking.Common.Configuration;
using IsraelHiking.DataAccessInterfaces.Repositories;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using Microsoft.VisualStudio.TestTools.UnitTesting;
using NetTopologySuite.Features;
using NetTopologySuite.Geometries;
using NSubstitute;
using System.Collections.Generic;
using System.Linq;

namespace IsraelHiking.API.Tests.Services
{
    [TestClass]
    public class AddibleGpxLinesFinderServiceTests
    {
        private IAddibleGpxLinesFinderService _service;
        private IHighwaysRepository _highwaysRepository;
        private ConfigurationData _options;

        private void SetupHighways(List<LineString> lineStrings = null)
        {
            lineStrings = lineStrings ?? new List<LineString>();
            var conveter = new ItmWgs84MathTransfromFactory().Create();
            var highways = lineStrings.Select(l => new Feature(new LineString(l.Coordinates.Select(c => conveter.Transform(c.X, c.Y))
                .Select(c => new Coordinate(c.x, c.y))
                .ToArray()),
                new AttributesTable())).ToList();
            int id = 1;
            foreach (var highway in highways)
            {
                highway.Attributes.Add(FeatureAttributes.ID, id.ToString());
                id++;
            }
            _highwaysRepository.GetHighways(Arg.Any<Coordinate>(), Arg.Any<Coordinate>()).Returns(highways);
        }

        [TestInitialize]
        public void TestInitialize()
        {
            _highwaysRepository = Substitute.For<IHighwaysRepository>();
            _options = new ConfigurationData();
            _options.MinimalProlongLineLength = 0;
            var optionsProvider = Substitute.For<IOptions<ConfigurationData>>();
            optionsProvider.Value.Returns(_options);
            var geometryFactory = new GeometryFactory();
            _service = new AddibleGpxLinesFinderService(new GpxLoopsSplitterExecutor(geometryFactory), new GpxProlongerExecutor(geometryFactory), new ItmWgs84MathTransfromFactory(), _highwaysRepository, optionsProvider, geometryFactory, Substitute.For<ILogger>());
        }

        [TestMethod]
        public void GetLines_StraightLine_ShouldReturnAsIs()
        {
            var gpxLine = new LineString(new[] { new Coordinate(0, 0), new Coordinate(1, 1), new Coordinate(2, 1) });
            _options.MaxNumberOfPointsPerLine = 5;
            _options.MaxLengthPerLine = 5;
            _options.MinimalMissingPartLength = 0;
            _options.MinimalDistanceToClosestPoint = 0;
            _options.MinimalMissingSelfLoopPartLength = 0;
            _options.SimplificationDistanceTolerance = 0;
            SetupHighways();

            var results = _service.GetLines(new List<LineString> { gpxLine }).Result.ToArray();

            Assert.AreEqual(1, results.Length);
            Assert.AreEqual(gpxLine.Coordinates.Length, results.First().Coordinates.Length);
        }

        [TestMethod]
        public void GetLines_GapInRecording_ShouldSplit()
        {
            var gpxLine = new LineString(new[]
            {
                new Coordinate(0, 0),
                new Coordinate(1, 0),
                new Coordinate(2, 0),
                new Coordinate(20, 0),
                new Coordinate(21, 0),
                new Coordinate(22, 0)
            });
            _options.MaxNumberOfPointsPerLine = 3;
            _options.MinimalMissingPartLength = 0;
            _options.MinimalDistanceToClosestPoint = 0;
            _options.MinimalMissingSelfLoopPartLength = 0;
            _options.SimplificationDistanceTolerance = 0;
            _options.MaxDistanceBetweenGpsRecordings = 10;
            SetupHighways();

            var results = _service.GetLines(new List<LineString> { gpxLine }).Result.ToArray();

            Assert.AreEqual(2, results.Length);
            Assert.AreEqual(2, results.First().Coordinates.Length);
            Assert.AreEqual(2, results.Last().Coordinates.Length);
        }

        [TestMethod]
        public void GetLines_GapInRecordingAtStart_ShouldSplit()
        {
            var gpxLine = new LineString(new[]
            {
                new Coordinate(0, 0),
                new Coordinate(20, 0),
                new Coordinate(21, 0),
                new Coordinate(22, 0),
            });
            _options.MaxNumberOfPointsPerLine = 3;
            _options.MinimalMissingPartLength = 0;
            _options.MinimalDistanceToClosestPoint = 0;
            _options.MinimalMissingSelfLoopPartLength = 0;
            _options.SimplificationDistanceTolerance = 0;
            _options.MaxDistanceBetweenGpsRecordings = 10;
            SetupHighways();

            var results = _service.GetLines(new List<LineString> { gpxLine }).Result.ToArray();

            Assert.AreEqual(1, results.Length);
            Assert.AreEqual(2, results.First().Coordinates.Length);
        }

        [TestMethod]
        public void GetLines_StraightLongLine_ShouldReturnSplitMergeAndSimplified()
        {
            var gpxLine = new LineString(new[]
            {
                new Coordinate(0, 0),
                new Coordinate(0, 1),
                new Coordinate(0, 2),
                new Coordinate(0, 3),
                new Coordinate(0, 4),
                new Coordinate(0, 5)
            });
            _options.MaxNumberOfPointsPerLine = 3;
            _options.MinimalMissingPartLength = 0;
            _options.MinimalDistanceToClosestPoint = 0;
            _options.MinimalMissingSelfLoopPartLength = 0;
            _options.SimplificationDistanceTolerance = 0;
            SetupHighways();

            var results = _service.GetLines(new List<LineString> { gpxLine }).Result.ToArray();

            Assert.AreEqual(1, results.Length);
            Assert.AreEqual(gpxLine.Coordinates.First(), results.First().Coordinates.First());
            Assert.AreEqual(gpxLine.Coordinates.Last(), results.First().Coordinates.Last());
        }

        [TestMethod]
        public void GetLines_StraightLineBetweenTwoLines_ShouldTakeRelevantPart()
        {
            var gpxItmLine = new LineString(new[]
            {
                new Coordinate(0, 0),
                new Coordinate(0, 10),
                new Coordinate(0, 20),
                new Coordinate(0, 30),
                new Coordinate(0, 40),
                new Coordinate(0, 50)
            });
            _options.MaxNumberOfPointsPerLine = 3;
            _options.MinimalDistanceToClosestPoint = 5;
            _options.MaxDistanceToExistingLineForMerge = 1;
            _options.MinimalMissingPartLength = 0;
            _options.MinimalMissingSelfLoopPartLength = 0;
            _options.SimplificationDistanceTolerance = 0;
            SetupHighways(new List<LineString> {
                new LineString(new [] { new Coordinate(0,0), new Coordinate(0,10)}),
                new LineString(new [] { new Coordinate(0,40), new Coordinate(0,50)})
            });

            var results = _service.GetLines(new List<LineString> { gpxItmLine }).Result.ToArray();

            Assert.AreEqual(1, results.Length);
            Assert.AreEqual(10, results.First().Coordinates.First().Y, 1);
            Assert.AreEqual(40, results.First().Coordinates.Last().Y, 1);
        }

        [TestMethod]
        public void GetLines_LineWithSelfLoop_ShouldRemoveDuplications()
        {
            var gpxItmLine = new LineString(new[]
            {
                new Coordinate(0, 0),
                new Coordinate(0, 10),
                new Coordinate(0, 20),
                new Coordinate(0, 30),
                new Coordinate(0, 40),
                new Coordinate(0, 50),
                new Coordinate(0, 40),
                new Coordinate(0, 30),
                new Coordinate(0, 20),
                new Coordinate(0, 10),
                new Coordinate(0, 0)
            });
            _options.MaxNumberOfPointsPerLine = 4;
            _options.MinimalDistanceToClosestPoint = 5;
            _options.MinimalMissingPartLength = 0;
            SetupHighways();

            var results = _service.GetLines(new List<LineString> { gpxItmLine }).Result.ToArray();

            Assert.AreEqual(1, results.Length);
            Assert.AreEqual(gpxItmLine.Coordinates[5], results.First().Coordinates.First());
            Assert.AreEqual(gpxItmLine.Coordinates[10], results.First().Coordinates.Last());
        }

        [TestMethod]
        public void GetLines_StraightLineBetweenTwoLines_ShouldTakeRelevantPartAndProlongItToAllowMerge()
        {
            var gpxItmLine = new LineString(new[]
            {
                new Coordinate(0, 0),
                new Coordinate(0, 10),
                new Coordinate(0, 11),
                new Coordinate(0, 12),
                new Coordinate(0, 13),
                new Coordinate(0, 14),
                new Coordinate(0, 15),
                new Coordinate(0, 16),
                new Coordinate(0, 25),
                new Coordinate(0, 34),
                new Coordinate(0, 35),
                new Coordinate(0, 36),
                new Coordinate(0, 37),
                new Coordinate(0, 38),
                new Coordinate(0, 39),
                new Coordinate(0, 40),
                new Coordinate(0, 50)
            });
            _options.MaxNumberOfPointsPerLine = 3;
            _options.MinimalDistanceToClosestPoint = 5;
            _options.MaxDistanceToExistingLineForMerge = 1;
            _options.MaxProlongLineLength = 200;
            _options.MinimalMissingPartLength = 0;
            _options.MinimalMissingSelfLoopPartLength = 0;
            _options.SimplificationDistanceTolerance = 0;

            SetupHighways(new List<LineString> {
                new LineString(new [] { new Coordinate(0,0), new Coordinate(0,10)}),
                new LineString(new [] { new Coordinate(0,40), new Coordinate(0,50)})
            });

            var results = _service.GetLines(new List<LineString> { gpxItmLine }).Result.ToArray();

            Assert.AreEqual(1, results.Length);
            Assert.AreEqual(10, results.First().Coordinates.First().Y, 1);
            Assert.AreEqual(40, results.First().Coordinates.Last().Y, 1);
        }

        [TestMethod]
        public void GetLines_TShapeLine_ShouldNotCreateAUShape()
        {
            var gpxItmLine = new LineString(new[]
            {
                new Coordinate(0, 0),
                new Coordinate(10, 0),
                new Coordinate(20, 0),
                new Coordinate(20, 10),
                new Coordinate(20, 20),
                new Coordinate(20, 30),
                new Coordinate(20, 40),
                new Coordinate(20, 50),
                new Coordinate(23, 50),
                new Coordinate(23, 40),
                new Coordinate(23, 30),
                new Coordinate(23, 20),
                new Coordinate(23, 10),
                new Coordinate(23, 0),
                new Coordinate(30, 0),
                new Coordinate(40, 0),
                new Coordinate(50, 0),
            });
            _options.MaxNumberOfPointsPerLine = 1000;
            _options.MinimalDistanceToClosestPoint = 10;
            _options.MaxLengthPerLine = 3000;
            _options.MaxDistanceToExistingLineForMerge = 5;
            _options.MaxProlongLineLength = 200;
            _options.MinimalMissingPartLength = 0;
            _options.MinimalMissingSelfLoopPartLength = 0;
            _options.SimplificationDistanceTolerance = 0;

            SetupHighways();

            var results = _service.GetLines(new List<LineString> { gpxItmLine }).Result.ToArray();

            Assert.AreEqual(2, results.Length);
            Assert.AreEqual(gpxItmLine.Coordinates.First(), results.First().Coordinates.First());
            Assert.AreEqual(gpxItmLine.Coordinates.Last(), results.Last().Coordinates.Last());
        }
    }
}
