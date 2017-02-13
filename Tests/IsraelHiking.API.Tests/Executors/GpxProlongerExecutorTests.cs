using System;
using System.Collections.Generic;
using System.Linq;
using GeoAPI.Geometries;
using IsraelHiking.API.Executors;
using Microsoft.VisualStudio.TestTools.UnitTesting;
using NetTopologySuite.Geometries;

namespace IsraelHiking.API.Tests.Executors
{
    [TestClass]
    public class GpxProlongerExecutorTests
    {
        private IGpxProlongerExecutor _executor;

        [TestInitialize]
        public void TestInitialize()
        {
            _executor = new GpxProlongerExecutor();
        }

        [TestMethod]
        public void ProlongStart_NoPoints_ShouldReturnOriginalLine()
        {
            var lineToProlong = new LineString(new [] { new Coordinate(0,0), new Coordinate(1,1)});

            var results = _executor.ProlongLineStart(lineToProlong, new Coordinate[0], new List<LineString>(), 5, 200);

            Assert.AreEqual(lineToProlong.Coordinates.Length, results.Coordinates.Length);
        }

        [TestMethod]
        public void ProlongEnd_NoPoints_ShouldReturnOriginalLine()
        {
            var lineToProlong = new LineString(new[] { new Coordinate(0, 0), new Coordinate(1, 1) });

            var results = _executor.ProlongLineEnd(lineToProlong, new Coordinate[0], new List<LineString>(), 5, 200);

            Assert.AreEqual(lineToProlong.Coordinates.Length, results.Coordinates.Length);
        }

        [TestMethod]
        public void ProlongEnd_PointsCrossesThreeLineIntersections_ShouldAddAPointWithoutCrossingLines()
        {
            var lineToProlong = new LineString(new[] { new Coordinate(0, 0), new Coordinate(1, 0) });
            var originlaCoordinates = new[] {new Coordinate(1, 0), new Coordinate(2, 0), new Coordinate(10, 0)};
            var existingLines = new List<LineString>
            {
                new LineString(new[] {new Coordinate(9, -9), new Coordinate(9, 9)}),
                new LineString(new[] {new Coordinate(8, -8), new Coordinate(8, 8)}),
                new LineString(new[] {new Coordinate(7, -7), new Coordinate(7, 7)})
            };

            var results = _executor.ProlongLineStart(lineToProlong, originlaCoordinates, existingLines, 5, 200);

            Assert.IsTrue(existingLines.Last().Intersects(results));
        }
    }
}
