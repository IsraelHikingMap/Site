using System.Collections.Generic;
using System.Linq;
using GeoAPI.Geometries;
using IsraelHiking.API.Executors;
using IsraelHiking.API.Services;
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
        private IElasticSearchGateway _elasticSearchGateway;
        private IConfigurationProvider _configurationProvider;

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
            _configurationProvider = Substitute.For<IConfigurationProvider>();
            var geometryFactory = GeometryFactory.Default;
            _service = new AddibleGpxLinesFinderService(new GpxLoopsSplitterExecutor(geometryFactory), new GpxProlongerExecutor(geometryFactory), new ItmWgs84MathTransfrom(), _elasticSearchGateway, _configurationProvider, geometryFactory, Substitute.For<ILogger>());
        }
        
        [TestMethod]
        public void GetLines_StraightLine_ShouldReturnAsIs()
        {
            var gpxLine = new LineString(new[] {new Coordinate(0, 0), new Coordinate(1, 1), new Coordinate(2, 1) });
            _configurationProvider.MaxNumberOfPointsPerLine.Returns(5);
            _configurationProvider.MaxLengthPerLine.Returns(5);
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
            _configurationProvider.MaxNumberOfPointsPerLine.Returns(3);
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
            _configurationProvider.MaxNumberOfPointsPerLine.Returns(3);
            _configurationProvider.ClosestPointTolerance.Returns(5);
            _configurationProvider.DistanceToExisitngLineMergeThreshold.Returns(1);
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
            _configurationProvider.MaxNumberOfPointsPerLine.Returns(4);
            _configurationProvider.ClosestPointTolerance.Returns(5);
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
            _configurationProvider.MaxNumberOfPointsPerLine.Returns(3);
            _configurationProvider.ClosestPointTolerance.Returns(5);
            _configurationProvider.DistanceToExisitngLineMergeThreshold.Returns(1);
            _configurationProvider.MaximalProlongLineLength.Returns(200);
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
            _configurationProvider.MaxNumberOfPointsPerLine.Returns(3);
            _configurationProvider.ClosestPointTolerance.Returns(5);
            _configurationProvider.MaxLengthPerLine.Returns(3);
            _configurationProvider.DistanceToExisitngLineMergeThreshold.Returns(1);
            _configurationProvider.MaximalProlongLineLength.Returns(200);
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
            _configurationProvider.MaxNumberOfPointsPerLine.Returns(1000);
            _configurationProvider.ClosestPointTolerance.Returns(10);
            _configurationProvider.MaxLengthPerLine.Returns(3000);
            _configurationProvider.DistanceToExisitngLineMergeThreshold.Returns(5);
            _configurationProvider.MaximalProlongLineLength.Returns(200);
            SetupHighways();

            var results = _service.GetLines(new List<ILineString> { gpxItmLine }).Result.ToArray();

            Assert.AreEqual(2, results.Length);
            Assert.AreEqual(gpxItmLine.Coordinates.First(), results.First().Coordinates.First());
            Assert.AreEqual(gpxItmLine.Coordinates.Last(), results.Last().Coordinates.Last());
        }
    }
}
