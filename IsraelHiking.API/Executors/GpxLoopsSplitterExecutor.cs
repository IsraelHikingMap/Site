using NetTopologySuite.Geometries;
using System.Collections.Generic;
using System.Linq;

namespace IsraelHiking.API.Executors;

/// <inheritdoc/>
public class GpxLoopsSplitterExecutor : IGpxLoopsSplitterExecutor
{
    private readonly GeometryFactory _geometryFactory;

    /// <summary>
    /// Constructor
    /// </summary>
    /// <param name="geometryFactory"></param>
    public GpxLoopsSplitterExecutor(GeometryFactory geometryFactory)
    {
        _geometryFactory = geometryFactory;
    }

    /// <inheritdoc/>
    public List<LineString> GetMissingLines(LineString gpxLine, IReadOnlyList<LineString> existingLineStrings, double minimalMissingPartLength, double minimalDistanceToClosestPoint)
    {
        if (gpxLine.Coordinates.Length <= 1)
        {
            return [];
        }
        var gpxSplit = new List<LineString>();
        var waypointsGroup = new List<Coordinate>();
            
        foreach (var coordinate in gpxLine.Coordinates)
        {
            if (IsCloseToALine(coordinate, existingLineStrings, minimalDistanceToClosestPoint))
            {
                waypointsGroup.Add(coordinate);
                AddLineString(gpxSplit, waypointsGroup.ToArray());
                waypointsGroup = [coordinate];
                continue;
            }
            waypointsGroup.Add(coordinate);
        }
        AddLineString(gpxSplit, waypointsGroup.ToArray());
        return gpxSplit.Where(l => l.Length > minimalMissingPartLength).ToList();
    }

    /// <inheritdoc/>
    public List<LineString> SplitSelfLoops(LineString gpxLine, double minimalDistanceToClosestPoint)
    {
        var lines = new List<LineString>();
        var reversedGpxLine = ReverseLine(gpxLine);

        int coordinateIndex = 0;
        while (coordinateIndex < reversedGpxLine.Coordinates.Length)
        {
            var indexOfClosingLine = GetClosingLoopIndex(reversedGpxLine, coordinateIndex, minimalDistanceToClosestPoint);
            if (indexOfClosingLine == -1)
            {
                coordinateIndex++;
                continue;
            }
            AddLineString(lines, reversedGpxLine.Coordinates.Take(indexOfClosingLine).ToArray());
            var reminingPoints = reversedGpxLine.Coordinates.Skip(indexOfClosingLine).ToArray();
            reversedGpxLine = reminingPoints.Length > 1 ? _geometryFactory.CreateLineString(reminingPoints) : _geometryFactory.CreateLineString([]);
            coordinateIndex = 0;
        }
        AddLineString(lines, reversedGpxLine.Coordinates);

        lines = lines.Select(ReverseLine).ToList();
        lines.Reverse();
        return lines;
    }

    private int GetClosingLoopIndex(LineString gpxLine, int currentIndex, double minimalDistanceToClosestPoint)
    {
        int indexOfFarEnoughLinePrefix = currentIndex - 1;
        var currentCoordinatePoint = new Point(gpxLine.Coordinates[currentIndex]);
        while (indexOfFarEnoughLinePrefix >= 0)
        {
            var prefixPoint = new Point(gpxLine.Coordinates[indexOfFarEnoughLinePrefix]);
            if (currentCoordinatePoint.Distance(prefixPoint) > minimalDistanceToClosestPoint)
            {
                break;
            }
            indexOfFarEnoughLinePrefix--;
        }
        if (indexOfFarEnoughLinePrefix < 0)
        {
            return -1;
        }
        var distance = indexOfFarEnoughLinePrefix > 0
            ? currentCoordinatePoint.Distance(new LineString(gpxLine.Coordinates.Take(indexOfFarEnoughLinePrefix + 1).ToArray()))
            : currentCoordinatePoint.Distance(new Point(gpxLine.Coordinates[indexOfFarEnoughLinePrefix]));
        return distance < minimalDistanceToClosestPoint ? indexOfFarEnoughLinePrefix + 1 : -1;
    }

    private void AddLineString(ICollection<LineString> gpxSplit, Coordinate[] coordinates)
    {
        if (coordinates.Length < 3)
        {
            return;
        }
        gpxSplit.Add(_geometryFactory.CreateLineString(coordinates));
    }

    private bool IsCloseToALine(Coordinate coordinate, IReadOnlyList<LineString> lineStrings, double minimalDistanceToClosestPoint)
    {
        var point = new Point(coordinate);
        if (!lineStrings.Any())
        {
            return false;
        }
        return lineStrings.Min(l => l.Distance(point)) < minimalDistanceToClosestPoint;
    }

    private LineString ReverseLine(LineString lineString)
    {
        return (LineString)lineString.Reverse();
    }
}