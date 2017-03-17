using System.Collections.Generic;
using System.Linq;
using GeoAPI.Geometries;
using IsraelHiking.API.Executors;
using IsraelHiking.API.Services;
using IsraelHiking.Common;
using IsraelHiking.DataAccessInterfaces;
using IsraelTransverseMercator;
using Microsoft.VisualStudio.TestTools.UnitTesting;
using NetTopologySuite.Features;
using NetTopologySuite.Geometries;
using NSubstitute;
using Microsoft.Extensions.Options;
using Microsoft.Extensions.Logging;

namespace IsraelHiking.API.Tests.Services
{
    [TestClass]
    public class AddibleGpxLinesFinderServiceTests
    {
        private IAddibleGpxLinesFinderService _service;
        private IElasticSearchGateway _elasticSearchGateway;
        private ConfigurationData _options;

        private void SetupHighways(List<LineString> lineStrings = null)
        {
            lineStrings = lineStrings ?? new List<LineString>();
            var conveter = new ItmWgs84MathTransfrom();
            var highways = lineStrings.Select(l => new Feature(new LineString(l.Coordinates.Select(conveter.Transform).ToArray()), new AttributesTable())).ToList();
            foreach (var highway in highways)
            {
                highway.Attributes.AddAttribute("osm_id", "1");
            }
            _elasticSearchGateway.GetHighways(Arg.Any<Coordinate>(), Arg.Any<Coordinate>()).Returns(highways);
        }

        [TestInitialize]
        public void TestInitialize()
        {
            _elasticSearchGateway = Substitute.For<IElasticSearchGateway>();
            _options = new ConfigurationData();
            var optionsProvider = Substitute.For<IOptions<ConfigurationData>>();
            optionsProvider.Value.Returns(_options);
            var geometryFactory = GeometryFactory.Default;
            _service = new AddibleGpxLinesFinderService(new GpxLoopsSplitterExecutor(geometryFactory), new GpxProlongerExecutor(geometryFactory), new ItmWgs84MathTransfrom(), _elasticSearchGateway, optionsProvider, geometryFactory, Substitute.For<ILogger>());
        }
        
        [TestMethod]
        public void GetLines_StraightLine_ShouldReturnAsIs()
        {
            var gpxLine = new LineString(new[] {new Coordinate(0, 0), new Coordinate(1, 1), new Coordinate(2, 1) });
            _options.MaxNumberOfPointsPerLine = 5;
            _options.MaxLengthPerLine = 5;
            _options.MinimalMissingPartLength = 0;
            _options.ClosestPointTolerance = 0;
            _options.MinimalMissingSelfLoopPartLegth = 0;
            _options.SimplificationTolerance = 0;
            SetupHighways();

            var results = _service.GetLines(new List<ILineString> {gpxLine}).Result.ToArray();

            Assert.AreEqual(1, results.Length);
            Assert.AreEqual(gpxLine.Coordinates.Length, results.First().Coordinates.Length);
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
            _options.ClosestPointTolerance = 0;
            _options.MinimalMissingSelfLoopPartLegth = 0;
            _options.SimplificationTolerance = 0;
            SetupHighways();

            var results = _service.GetLines(new List<ILineString> { gpxLine }).Result.ToArray();

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
            _options.ClosestPointTolerance = 5;
            _options.DistanceToExisitngLineMergeThreshold = 1;
            _options.MinimalMissingPartLength = 0;
            _options.MinimalMissingSelfLoopPartLegth = 0;
            _options.SimplificationTolerance = 0;
            SetupHighways(new List<LineString> {
                new LineString(new [] { new Coordinate(0,0), new Coordinate(0,10)}),
                new LineString(new [] { new Coordinate(0,40), new Coordinate(0,50)})
            });

            var results = _service.GetLines(new List<ILineString> { gpxItmLine }).Result.ToArray();

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
            _options.ClosestPointTolerance = 5;
            _options.MinimalMissingPartLength = 0;
            SetupHighways();

            var results = _service.GetLines(new List<ILineString> { gpxItmLine }).Result.ToArray();

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
            _options.ClosestPointTolerance = 5;
            _options.DistanceToExisitngLineMergeThreshold = 1;
            _options.MaximalProlongLineLength = 200;
            _options.MinimalMissingPartLength = 0;
            _options.MinimalMissingSelfLoopPartLegth = 0;
            _options.SimplificationTolerance = 0;

            SetupHighways(new List<LineString> {
                new LineString(new [] { new Coordinate(0,0), new Coordinate(0,10)}),
                new LineString(new [] { new Coordinate(0,40), new Coordinate(0,50)})
            });

            var results = _service.GetLines(new List<ILineString> { gpxItmLine }).Result.ToArray();

            Assert.AreEqual(1, results.Length);
            Assert.AreEqual(10, results.First().Coordinates.First().Y, 1);
            Assert.AreEqual(40, results.First().Coordinates.Last().Y, 1);
        }

        [TestMethod]
        public void GetLines_PointsAreTooSparse_ShouldSliptAccoringToDistance()
        {
            var gpxItmLine = new LineString(new[]
            {
                new Coordinate(0, 0),
                new Coordinate(0, 10),
                new Coordinate(0, 20),
                new Coordinate(0, 30),
                new Coordinate(0, 40),
            });
            _options.MaxNumberOfPointsPerLine = 3;
            _options.ClosestPointTolerance = 5;
            _options.MaxLengthPerLine = 3;
            _options.DistanceToExisitngLineMergeThreshold = 1;
            _options.MaximalProlongLineLength = 200;
            _options.MinimalMissingPartLength = 0;
            _options.MinimalMissingSelfLoopPartLegth = 0;
            _options.SimplificationTolerance = 0;
            SetupHighways();

            var results = _service.GetLines(new List<ILineString> { gpxItmLine }).Result.ToArray();

            Assert.AreEqual(0, results.Length);
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
            _options.ClosestPointTolerance = 10;
            _options.MaxLengthPerLine = 3000;
            _options.DistanceToExisitngLineMergeThreshold = 5;
            _options.MaximalProlongLineLength = 200;
            _options.MinimalMissingPartLength = 0;
            _options.MinimalMissingSelfLoopPartLegth = 0;
            _options.SimplificationTolerance = 0;
            
            SetupHighways();

            var results = _service.GetLines(new List<ILineString> { gpxItmLine }).Result.ToArray();

            Assert.AreEqual(2, results.Length);
            Assert.AreEqual(gpxItmLine.Coordinates.First(), results.First().Coordinates.First());
            Assert.AreEqual(gpxItmLine.Coordinates.Last(), results.Last().Coordinates.Last());
        }
    }
}
