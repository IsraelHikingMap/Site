using IsraelHiking.API.Services;
using Microsoft.VisualStudio.TestTools.UnitTesting;
using NetTopologySuite.Geometries;
using System.Linq;

namespace IsraelHiking.API.Tests.Services;

[TestClass]
public class RadialDistanceByAngleSimplifierTests
{
    [TestMethod]
    public void SimplifyEmptyLine_ShouldReturnNull()
    {
        var simplified = RadialDistanceByAngleSimplifier.Simplify(new LineString([]), 0, 0);

        Assert.IsNull(simplified);
    }

    [TestMethod]
    public void SimplifyEmptyLine_AlreadySimplified_ShouldReturnIt()
    {
        var line = new LineString([
            new Coordinate(0,0),
            new Coordinate(100, 0)
        ]);

        var simplified = RadialDistanceByAngleSimplifier.Simplify(line, 30, 90);

        Assert.AreEqual(simplified.Count, line.Count);
    }

    [TestMethod]
    public void SimplifyLine_ZigZag_ShouldReturnRemoveIt()
    {
        var coordinateThatShouldBeRemoved = new Coordinate(1, 0);
        var line = new LineString([
            new Coordinate(0,0),
            new Coordinate(10, 0),
            coordinateThatShouldBeRemoved,
            new Coordinate(11, 0),
            new Coordinate(0, 0)
        ]);

        var simplified = RadialDistanceByAngleSimplifier.Simplify(line, 30, 90);

        Assert.IsFalse(simplified.Coordinates.Contains(coordinateThatShouldBeRemoved));
    }

    [TestMethod]
    public void SimplifyLine_NoSimplificationNeeded_ShouldReturnSameLine()
    {
        var line = new LineString([
            new Coordinate(0,0),
            new Coordinate(100, 0),
            new Coordinate(200, 0),
            new Coordinate(300, 0)
        ]);

        var simplified = RadialDistanceByAngleSimplifier.Simplify(line, 30, 90);

        Assert.AreEqual(line.Coordinates.Length, simplified.Coordinates.Length);
    }

    [TestMethod]
    public void SimplifyLine_ShouldSimplifyByAngle_ShouldReturnSimplifiedLine()
    {
        var line = new LineString([
            new Coordinate(0,0),
            new Coordinate(100, 0),
            new Coordinate(100, 20),
            new Coordinate(100, 200)
        ]);

        var simplified = RadialDistanceByAngleSimplifier.Simplify(line, 30, 90);

        Assert.AreEqual(line.Coordinates.Length - 1, simplified.Coordinates.Length);
    }

    [TestMethod]
    public void SimplifyLine_ShouldNotSimplifyByAngleDueToDistance_ShouldReturnSimplifiedLine()
    {
        var line = new LineString([
            new Coordinate(0,0),
            new Coordinate(100, 0),
            new Coordinate(0, 1),
            new Coordinate(100, 1)
        ]);

        var simplified = RadialDistanceByAngleSimplifier.Simplify(line, 30, 90);

        Assert.AreEqual(line.Coordinates.Length, simplified.Coordinates.Length);
    }
}