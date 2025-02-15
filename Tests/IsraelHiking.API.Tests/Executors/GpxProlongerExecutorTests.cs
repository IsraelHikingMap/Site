using IsraelHiking.API.Executors;
using Microsoft.VisualStudio.TestTools.UnitTesting;
using NetTopologySuite.Geometries;
using System.Collections.Generic;
using System.Linq;

namespace IsraelHiking.API.Tests.Executors;

[TestClass]
public class GpxProlongerExecutorTests
{
    private IGpxProlongerExecutor _executor;

    [TestInitialize]
    public void TestInitialize()
    {
        _executor = new GpxProlongerExecutor(new GeometryFactory());
    }

    /// <summary>
    /// __.|._
    ///    |  |
    ///    |__|
    /// </summary>
    [TestMethod]
    public void Prolong_ClosingSelfLargeArea_ShouldProlong()
    {
        var lineToProlong = new LineString([
            new Coordinate(500, 0),
            new Coordinate(600, 0),
            new Coordinate(600, -10),
            new Coordinate(600, -20),
            new Coordinate(500, -20),
            new Coordinate(400, -20),
            new Coordinate(400, -10),
            new Coordinate(400, 0),
            new Coordinate(400, 10)
        ]);
        var originlaCoordinates = new[]
        {
            new Coordinate(0, 0),
            new Coordinate(100, 0),
            new Coordinate(200, 0),
            new Coordinate(300, 0),
            new Coordinate(401, 0),
            new Coordinate(500, 0),
            new Coordinate(600, 0),
            new Coordinate(600, -10),
            new Coordinate(600, -20),
            new Coordinate(500, -20),
            new Coordinate(400, -20),
            new Coordinate(400, -10),
            new Coordinate(400, 0),
            new Coordinate(400, 10)
        };
        var existingLines = new List<LineString>();
        var input = new GpxProlongerExecutorInput
        {
            LinesToProlong = [lineToProlong],
            OriginalCoordinates = originlaCoordinates,
            ExistingItmHighways = existingLines,
            MinimalDistance = 2,
            MinimalAreaSize = 1000
        };

        var results = _executor.Prolong(input);

        Assert.AreEqual(1, results.Count);
        Assert.AreEqual(lineToProlong.Coordinates.Last(), results.First().Coordinates.Last());
        Assert.AreEqual(lineToProlong.Coordinates[7], results.First().Coordinates.First());
    }

    /// <summary>
    /// __..__
    /// </summary>
    [TestMethod]
    public void Prolong_TwoSepeateLines_ShouldProlong()
    {
        var linesToProlong = new List<LineString>
        {
            new LineString([
                new Coordinate(0, 0),
                new Coordinate(10, 0)
            ]),
            new LineString([
                new Coordinate(40, 0),
                new Coordinate(50, 0)
            ])
        };
        var originlaCoordinates = new[]
        {
            new Coordinate(0, 0),
            new Coordinate(10, 0),
            new Coordinate(20, 0),
            new Coordinate(30, 0),
            new Coordinate(40, 0),
            new Coordinate(50, 0)
        };
        var existingLines = new List<LineString>();
        var input = new GpxProlongerExecutorInput
        {
            LinesToProlong = linesToProlong,
            OriginalCoordinates = originlaCoordinates,
            ExistingItmHighways = existingLines,
            MinimalDistance = 2,
            MinimalAreaSize = 1000
        };

        var results = _executor.Prolong(input);

        Assert.AreEqual(1, results.Count);
        Assert.AreEqual(linesToProlong.First().Coordinates.First(), results.First().Coordinates.First());
        Assert.AreEqual(linesToProlong.Last().Coordinates.Last(), results.Last().Coordinates.Last());
    }

    /// <summary>
    /// ___
    /// \|
    /// </summary>
    [TestMethod]
    public void Prolong_TwoIntersectingLinesWithSmallArea_ShouldNotProlong()
    {
        var linesToProlong = new List<LineString>
        {
            new LineString([
                new Coordinate(0, 0),
                new Coordinate(10, 0),
                new Coordinate(20, 0),
                new Coordinate(30, 0)
            ]),
            new LineString([
                new Coordinate(20, 0),
                new Coordinate(20, -10),
                new Coordinate(20, -20)
            ])
        };
        var originlaCoordinates = new[]
        {
            new Coordinate(0, 0),
            new Coordinate(10, 0),
            new Coordinate(20, 0),
            new Coordinate(30, 0),
            new Coordinate(20, 0),
            new Coordinate(20, -10),
            new Coordinate(20, -20),
            new Coordinate(20, -10),
            new Coordinate(0, 0),
        };
        var existingLines = new List<LineString>();
        var input = new GpxProlongerExecutorInput
        {
            LinesToProlong = linesToProlong,
            OriginalCoordinates = originlaCoordinates,
            ExistingItmHighways = existingLines,
            MinimalDistance = 2,
            MinimalAreaSize = 1000
        };

        var results = _executor.Prolong(input);

        Assert.AreEqual(2, results.Count);
    }

    /// <summary>
    /// ___
    /// \|
    /// </summary>
    [TestMethod]
    public void Prolong_TwoIntersectingLinesWithLargeArea_ShouldNotProlong()
    {
        var linesToProlong = new List<LineString>
        {
            new LineString([
                new Coordinate(0, 0),
                new Coordinate(100, 0),
                new Coordinate(200, 0),
                new Coordinate(300, 0)
            ]),
            new LineString([
                new Coordinate(200, 0),
                new Coordinate(200, -100),
                new Coordinate(200, -200)
            ])
        };
        var originlaCoordinates = new[]
        {
            new Coordinate(0, 0),
            new Coordinate(100, 0),
            new Coordinate(200, 0),
            new Coordinate(300, 0),
            new Coordinate(200, 0),
            new Coordinate(200, -100),
            new Coordinate(200, -200),
            new Coordinate(200, -100),
            new Coordinate(0, 0),
        };
        var existingLines = new List<LineString>();
        var input = new GpxProlongerExecutorInput
        {
            LinesToProlong = linesToProlong,
            OriginalCoordinates = originlaCoordinates,
            ExistingItmHighways = existingLines,
            MinimalDistance = 2,
            MinimalAreaSize = 1000
        };

        var results = _executor.Prolong(input);

        Assert.AreEqual(3, results.Count);
        Assert.AreEqual(linesToProlong.First().Coordinates.First(), results.First().Coordinates.Last());
    }

    /// <summary>
    /// __.|
    /// </summary>
    [TestMethod]
    public void Prolong_LineToExistingLine_ShouldProlong()
    {
        var linesToProlong = new List<LineString>
        {
            new LineString([
                new Coordinate(0, 0),
                new Coordinate(10, 0)
            ])
        };
        var originlaCoordinates = new[]
        {
            new Coordinate(0, 0),
            new Coordinate(10, 0),
            new Coordinate(20, 0)
        };
        var existingLines = new List<LineString>
        {
            new LineString([
                new Coordinate(20, 0),
                new Coordinate(20, 10)
            ])
        };
        var input = new GpxProlongerExecutorInput
        {
            LinesToProlong = linesToProlong,
            OriginalCoordinates = originlaCoordinates,
            ExistingItmHighways = existingLines,
            MinimalDistance = 2,
            MinimalAreaSize = 1000
        };

        var results = _executor.Prolong(input);

        Assert.AreEqual(1, results.Count);
        Assert.AreEqual(originlaCoordinates.Last(), results.First().Coordinates.Last());
    }

    /// <summary>
    ///  |
    ///  .
    /// ___
    /// </summary>
    [TestMethod]
    public void Prolong_TLines_ShouldProlongAndMerge()
    {
        var linesToProlong = new List<LineString>
        {
            new LineString([
                new Coordinate(0, 0),
                new Coordinate(10, 0),
                new Coordinate(20, 0),
                new Coordinate(30, 0)
            ]),
            new LineString([
                new Coordinate(20, 20),
                new Coordinate(20, 30)
            ])
        };
        var originlaCoordinates = new[]
        {
            new Coordinate(0, 0),
            new Coordinate(10, 0),
            new Coordinate(20, 0),
            new Coordinate(30, 0),
            new Coordinate(20, 0),
            new Coordinate(20, 10),
            new Coordinate(20, 20),
            new Coordinate(20, 30)
        };
        var existingLines = new List<LineString>();
        var input = new GpxProlongerExecutorInput
        {
            LinesToProlong = linesToProlong,
            OriginalCoordinates = originlaCoordinates,
            ExistingItmHighways = existingLines,
            MinimalDistance = 2,
            MinimalAreaSize = 1000
        };

        var results = _executor.Prolong(input);

        Assert.AreEqual(2, results.Count);
        Assert.AreEqual(originlaCoordinates.Last(), results.First().Coordinates.Last());
    }


    /// <summary>
    ///    ...
    /// ___.  .___
    /// </summary>
    [TestMethod]
    public void Prolong_NoneStraightGap_ShouldProlongAccordingToGap()
    {
        var linesToProlong = new List<LineString>
        {
            new LineString([
                new Coordinate(0, 0),
                new Coordinate(10, 0),
                new Coordinate(20, 0),
                new Coordinate(30, 0)
            ]),
            new LineString([
                new Coordinate(50, 0),
                new Coordinate(60, 0)
            ])
        };
        var originlaCoordinates = new[]
        {
            new Coordinate(0, 0),
            new Coordinate(10, 0),
            new Coordinate(20, 0),
            new Coordinate(30, 0),
            new Coordinate(30, 10),
            new Coordinate(40, 10),
            new Coordinate(50, 10),
            new Coordinate(50, 0),
            new Coordinate(60, 0)
        };
        var existingLines = new List<LineString>();
        var input = new GpxProlongerExecutorInput
        {
            LinesToProlong = linesToProlong,
            OriginalCoordinates = originlaCoordinates,
            ExistingItmHighways = existingLines,
            MinimalDistance = 2,
            MinimalAreaSize = 1000
        };

        var results = _executor.Prolong(input);

        Assert.AreEqual(1, results.Count);
        Assert.AreEqual(0, results.First().Distance(new Point(new Coordinate(40, 10))));
    }


    [TestMethod]
    public void Prolong_TLinesVeryClose_ShouldProlongAndMerge()
    {
        var linesToProlong = new List<LineString>
        {
            new LineString([
                new Coordinate(0, 0),
                new Coordinate(10, 0),
                new Coordinate(20, 0),
                new Coordinate(30, 0)
            ]),
            new LineString([
                new Coordinate(20, 0.01),
                new Coordinate(20, 10),
                new Coordinate(20, 20),
                new Coordinate(20, 30)
            ])
        };
        var originlaCoordinates = new[]
        {
            new Coordinate(20, 30),
            new Coordinate(10, 15),
            new Coordinate(0, 0),
            new Coordinate(10, 0),
            new Coordinate(20, 0),
            new Coordinate(30, 0),
            new Coordinate(20, 0.01),
            new Coordinate(20, 10),
            new Coordinate(20, 20),
            new Coordinate(20, 30)
        };
        var existingLines = new List<LineString>();
        var input = new GpxProlongerExecutorInput
        {
            LinesToProlong = linesToProlong,
            OriginalCoordinates = originlaCoordinates,
            ExistingItmHighways = existingLines,
            MinimalDistance = 2,
            MinimalAreaSize = 1000
        };

        var results = _executor.Prolong(input);

        // intersect issue
        Assert.AreEqual(2, results.Count);
        Assert.AreEqual(originlaCoordinates.Last(), results.Last().Coordinates.Last());
    }

    /// <summary>
    ///  /|
    /// /_|
    /// </summary>
    [TestMethod]
    public void Prolong_LinesIntersects_ShouldAddASection()
    {
        var linesToProlong = new List<LineString>
        {
            new LineString([
                new Coordinate(90, 10),
                new Coordinate(10, 90)
            ])
        };
        var originlaCoordinates = new[]
        {
            new Coordinate(100, 0),
            new Coordinate(90, 10),
            new Coordinate(10, 90),
            new Coordinate(0, 100)
        };
        var existingLines = new List<LineString>
        {
            new LineString([
                new Coordinate(0, -100),
                new Coordinate(0, -50),
                new Coordinate(0, 0),
                new Coordinate(0, 50),
                new Coordinate(0, 100)
            ]),
            new LineString([
                new Coordinate(-100, 0),
                new Coordinate(-50, 0),
                new Coordinate(0, 0),
                new Coordinate(50, 0),
                new Coordinate(100, 0)
            ])
        };
        var input = new GpxProlongerExecutorInput
        {
            LinesToProlong = linesToProlong,
            OriginalCoordinates = originlaCoordinates,
            ExistingItmHighways = existingLines,
            MinimalDistance = 2,
            MinimalAreaSize = 1000
        };

        var results = _executor.Prolong(input);

        Assert.AreEqual(1, results.Count);
        Assert.AreEqual(originlaCoordinates.Last(), results.First().Coordinates.Last());
    }

    /// <summary>
    /// __....__
    /// </summary>
    [TestMethod]
    public void Prolong_PreferLineEnd_ShouldProlong()
    {
        var linesToProlong = new List<LineString>
        {
            new LineString([
                new Coordinate(0, 0),
                new Coordinate(9, 0),
                new Coordinate(10, 0)
            ]),
            new LineString([
                new Coordinate(40, 0),
                new Coordinate(41, 0),
                new Coordinate(50, 0)
            ])
        };
        var originlaCoordinates = new[]
        {
            new Coordinate(0, 0),
            new Coordinate(9, 0),
            new Coordinate(10, 0),
            new Coordinate(11, 0),
            new Coordinate(12, 0),
            new Coordinate(38, 0),
            new Coordinate(39, 0),
            new Coordinate(40, 0),
            new Coordinate(41, 0),
            new Coordinate(50, 0),
        };
        var existingLines = new List<LineString>();
        var input = new GpxProlongerExecutorInput
        {
            LinesToProlong = linesToProlong,
            OriginalCoordinates = originlaCoordinates,
            ExistingItmHighways = existingLines,
            MinimalDistance = 2,
            MinimalAreaSize = 1000
        };

        var results = _executor.Prolong(input);

        Assert.AreEqual(1, results.Count);
        Assert.AreEqual(linesToProlong.First().Coordinates.First(), results.First().Coordinates.First());
        Assert.AreEqual(linesToProlong.Last().Coordinates.Last(), results.Last().Coordinates.Last());
    }

    /// <summary>
    /// ________________________
    ///            ..
    /// </summary>
    [TestMethod]
    public void Prolong_SimplifiedLongLine_ShouldNotProlong()
    {
        var linesToProlong = new List<LineString>
        {
            new LineString([
                new Coordinate(0, 0),
                new Coordinate(1000, 0)
            ])
        };
        var originlaCoordinates = new[]
        {
            new Coordinate(0, 0),
            new Coordinate(100, 0),
            new Coordinate(200, 0),
            new Coordinate(300, 0),
            new Coordinate(400, 1),
            new Coordinate(500, 1),
            new Coordinate(600, 1),
            new Coordinate(700, 0),
            new Coordinate(800, 0),
            new Coordinate(900, 0),
            new Coordinate(1000, 0),
        };
        var existingLines = new List<LineString>();
        var input = new GpxProlongerExecutorInput
        {
            LinesToProlong = linesToProlong,
            OriginalCoordinates = originlaCoordinates,
            ExistingItmHighways = existingLines,
            MinimalDistance = 2,
            MinimalAreaSize = 1000
        };

        var results = _executor.Prolong(input);

        Assert.AreEqual(1, results.Count);
        Assert.AreEqual(linesToProlong.First().Coordinates.First(), results.First().Coordinates.First());
        Assert.AreEqual(linesToProlong.Last().Coordinates.Last(), results.Last().Coordinates.Last());
    }
}