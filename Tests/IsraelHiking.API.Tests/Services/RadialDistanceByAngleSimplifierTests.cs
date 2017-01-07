using GeoAPI.Geometries;
using IsraelHiking.API.Services;
using Microsoft.VisualStudio.TestTools.UnitTesting;
using NetTopologySuite.Geometries;

namespace IsraelHiking.API.Tests.Services
{
    [TestClass]
    public class RadialDistanceByAngleSimplifierTests
    {
        [TestMethod]
        public void SimplifyEmptyLine_ShouldReturnNull()
        {
            var simplified = RadialDistanceByAngleSimplifier.Simplify(new LineString(new Coordinate[0]), 0, 0);

            Assert.IsNull(simplified);
        }

        [TestMethod]
        public void SimplifyLine_AllPointsAreInABunch_ShouldReturnNull()
        {
            var line = new LineString(new[]
            {
                new Coordinate(0,0),
                new Coordinate(10, 0),
                new Coordinate(0, 0),
                new Coordinate(10, 0),
                new Coordinate(0, 0),
            });

            var simplified = RadialDistanceByAngleSimplifier.Simplify(line, 30, 30);

            Assert.IsNull(simplified);
        }

        [TestMethod]
        public void SimplifyLine_NoSimplificationNeeded_ShouldReturnSameLine()
        {
            var line = new LineString(new[]
            {
                new Coordinate(0,0),
                new Coordinate(100, 0),
                new Coordinate(200, 0),
                new Coordinate(300, 0),
            });

            var simplified = RadialDistanceByAngleSimplifier.Simplify(line, 30, 30);

            Assert.AreEqual(line.Coordinates.Length, simplified.Coordinates.Length);
        }

        [TestMethod]
        public void SimplifyLine_ShouldSimplifyByAngle_ShouldReturnSimplifiedLine()
        {
            var line = new LineString(new[]
            {
                new Coordinate(0,0),
                new Coordinate(100, 0),
                new Coordinate(100, 20),
                new Coordinate(100, 200),
            });

            var simplified = RadialDistanceByAngleSimplifier.Simplify(line, 30, 90);

            Assert.AreEqual(line.Coordinates.Length - 1, simplified.Coordinates.Length);
        }
    }
}
