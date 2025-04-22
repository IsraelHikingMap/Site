using IsraelHiking.API.Executors;
using IsraelHiking.Common.Configuration;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using NetTopologySuite.Geometries;
using NetTopologySuite.LinearReferencing;
using NetTopologySuite.Simplify;
using ProjNet.CoordinateSystems.Transformations;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using IsraelHiking.Common.Extensions;
using IsraelHiking.DataAccessInterfaces;

namespace IsraelHiking.API.Services;

/// <inheritdoc/>
public class AddibleGpxLinesFinderService : IAddibleGpxLinesFinderService
{
    private readonly IGpxLoopsSplitterExecutor _gpxLoopsSplitterExecutor;
    private readonly IGpxProlongerExecutor _gpxProlongerExecutor;
    private readonly IOsmGeoJsonPreprocessorExecutor _osmGeoJsonPreprocessorExecutor;
    private readonly MathTransform _itmWgs84MathTransform;
    private readonly MathTransform _wgs84ItmMathTransform;
    private readonly IOverpassTurboGateway _overpassGateway;
    private readonly GeometryFactory _geometryFactory;
    private readonly ILogger _logger;
    private readonly ConfigurationData _options;

    /// <summary>
    /// Constructor
    /// </summary>
    /// <param name="gpxLoopsSplitterExecutor"></param>
    /// <param name="gpxProlongerExecutor"></param>
    /// <param name="itmWgs84MathTransformFactory"></param>
    /// <param name="overpassGateway"></param>
    /// <param name="options"></param>
    /// <param name="geometryFactory"></param>
    /// <param name="osmGeoJsonPreprocessorExecutor"></param>
    /// <param name="logger"></param>
    public AddibleGpxLinesFinderService(IGpxLoopsSplitterExecutor gpxLoopsSplitterExecutor,
        IGpxProlongerExecutor gpxProlongerExecutor,
        IItmWgs84MathTransformFactory itmWgs84MathTransformFactory,
        IOverpassTurboGateway overpassGateway,
        IOptions<ConfigurationData> options,
        GeometryFactory geometryFactory,
        IOsmGeoJsonPreprocessorExecutor osmGeoJsonPreprocessorExecutor,
        ILogger logger)
    {
        _gpxLoopsSplitterExecutor = gpxLoopsSplitterExecutor;
        _gpxProlongerExecutor = gpxProlongerExecutor;
        _itmWgs84MathTransform = itmWgs84MathTransformFactory.Create();
        _wgs84ItmMathTransform = itmWgs84MathTransformFactory.CreateInverse();
        _overpassGateway = overpassGateway;
        _geometryFactory = geometryFactory;
        _logger = logger;
        _osmGeoJsonPreprocessorExecutor = osmGeoJsonPreprocessorExecutor;
        _options = options.Value;
    }

    /// <inheritdoc/>
    public async Task<IEnumerable<LineString>> GetLines(List<LineString> gpxItmLines)
    {
        _logger.LogInformation($"Looking for unmapped routes started on {gpxItmLines.Count} traces");
        gpxItmLines = SplitGpxLines(gpxItmLines);
        gpxItmLines = IncreaseGpxDensity(gpxItmLines);
        var linesToReturn = new List<LineString>();
        foreach (var gpxItmLine in gpxItmLines)
        {
            var currentLines = await FindMissingLines(gpxItmLine, linesToReturn);
            currentLines = SplitSelfLoopsAndRemoveDuplication(currentLines);
            currentLines = SimplifyLines(currentLines);
            currentLines = await ProlongLinesAccordingToOriginalGpx(currentLines, gpxItmLine);
            currentLines = MergeLines(currentLines);
            currentLines = SimplifyLines(currentLines); // need to simplify to remove sharp corners
            currentLines = AdjustIntersections(currentLines); // intersections may have moved after simplification
            currentLines = MergeLines(currentLines); // after adjusting intersections, possible merge options
            linesToReturn.AddRange(currentLines);
        }

        _logger.LogInformation($"Looking for unmapped routes finished, found {linesToReturn.Count} routes.");
        return linesToReturn;
    }

    private List<LineString> SplitGpxLines(List<LineString> gpxItmLines)
    {
        var splitGpxLines = new List<LineString>();
        foreach (var lineString in gpxItmLines)
        {
            var coordinates = lineString.Coordinates.ToArray();
            for (int coordinateIndex = 1; coordinateIndex < coordinates.Length; coordinateIndex++)
            {
                if (coordinates[coordinateIndex - 1].Distance(coordinates[coordinateIndex]) > _options.MaxDistanceBetweenGpsRecordings)
                {
                    if (coordinateIndex > 1)
                    {
                        // need to add line only if there's more than 1 coordinate to take.
                        splitGpxLines.Add(_geometryFactory.CreateLineString(coordinates.Take(coordinateIndex).ToArray()));
                    }
                    coordinates = coordinates.Skip(coordinateIndex).ToArray();
                    coordinateIndex = 1;
                }
            }
            splitGpxLines.Add(_geometryFactory.CreateLineString(coordinates.ToArray()));
        }
        return splitGpxLines.Where(l => l.Coordinates.Length > 0).ToList();
    }

    private List<LineString> IncreaseGpxDensity(List<LineString> gpxItmLines)
    {
        var denseGpxLines = new List<LineString>();
        foreach (var gpxItmLine in gpxItmLines.Where(l => l.Coordinates.Length > 0))
        {
            var coordinates = gpxItmLine.Coordinates.ToList();
            for (int coordinateIndex = 0; coordinateIndex < coordinates.Count - 1; coordinateIndex++)
            {
                var currentCoordinate = coordinates[coordinateIndex];
                var nextCoordinate = coordinates[coordinateIndex + 1];
                if (currentCoordinate.Distance(nextCoordinate) > 2 * _options.MaxDistanceToExistingLineForMerge)
                {
                    var directionSegment = new LineSegment(currentCoordinate, nextCoordinate);
                    var coordinate = directionSegment.PointAlong((_options.MaxDistanceToExistingLineForMerge) /( 2.0 * directionSegment.Length ));
                    coordinates.Insert(coordinateIndex + 1, coordinate);
                }
                else if (currentCoordinate.Distance(nextCoordinate) > _options.MaxDistanceToExistingLineForMerge)
                {
                    var middle = new Coordinate((currentCoordinate.X + nextCoordinate.X) / 2.0, (currentCoordinate.Y + nextCoordinate.Y) / 2.0);
                    coordinates.Insert(coordinateIndex + 1, middle);
                }
            }
            denseGpxLines.Add(_geometryFactory.CreateLineString(coordinates.Select(c => new Coordinate(Math.Round(c.X, 1), Math.Round(c.Y, 1))).ToArray()));
        }
        return denseGpxLines;
    }

    private List<LineString> SplitSelfLoopsAndRemoveDuplication(List<LineString> missingLines)
    {
        var missingLinesWithoutLoops = new List<LineString>();
        foreach (var missingLine in missingLines)
        {
            missingLinesWithoutLoops.AddRange(_gpxLoopsSplitterExecutor.SplitSelfLoops(missingLine, _options.MinimalDistanceToClosestPoint));
        }
        missingLinesWithoutLoops.Reverse(); // remove duplications set higher priority to lines that were recorded later
        var missingLinesWithoutLoopsAndDuplications = new List<LineString>();
        foreach (var missingLineWithoutLoops in missingLinesWithoutLoops)
        {
            var linesToAdd = _gpxLoopsSplitterExecutor.GetMissingLines(missingLineWithoutLoops,
                missingLinesWithoutLoopsAndDuplications.ToArray(),
                _options.MinimalMissingSelfLoopPartLength,
                _options.MinimalDistanceToClosestPoint);
            linesToAdd.Reverse();
            missingLinesWithoutLoopsAndDuplications.AddRange(linesToAdd);
        }
        missingLinesWithoutLoopsAndDuplications.Reverse(); // reverse back to keep the original order of the lines
        return missingLinesWithoutLoopsAndDuplications;
    }

    private List<LineString> SimplifyLines(IEnumerable<LineString> lineStings)
    {
        var lines = new List<LineString>();
        foreach (var lineSting in lineStings)
        {
            var simpleLine = DouglasPeuckerSimplifier.Simplify(lineSting, _options.SimplificationDistanceTolerance) as LineString;
            if (simpleLine == null)
            {
                continue;
            }
            simpleLine = RadialDistanceByAngleSimplifier.Simplify(simpleLine, _options.RadialDistanceTolerance, _options.RadialSimplificationAngle);
            if (simpleLine == null)
            {
                continue;
            }
            lines.Add(simpleLine);
        }
        return lines;
    }

    private async Task<List<LineString>> GetExistingCloseLines(LineString gpxItmLine)
    {
        var existingLines = new List<LineString>();
        var splitItmLines = SplitLine(gpxItmLine);
        foreach (var itmLine in splitItmLines)
        {
            var lineStringsInArea = await GetLineStringsInArea(itmLine, _options.MinimalDistanceToClosestPoint);
            existingLines.AddRange(lineStringsInArea.Where(l => l.Distance(itmLine) < _options.MinimalDistanceToClosestPoint));
        }
        return existingLines.GroupBy(l => l.GetOsmId()).Select(g => g.First()).ToList();
    }

    private async Task<List<LineString>> FindMissingLines(LineString gpxItmLine, List<LineString> missingLinesThatWereFound)
    {
        var missingLinesSplit = new List<LineString>();
        var splitItmLines = SplitLine(gpxItmLine);
        foreach (var itmLine in splitItmLines)
        {
            var lineStringsInArea = await GetLineStringsInArea(itmLine, _options.MinimalDistanceToClosestPoint);
            lineStringsInArea.AddRange(missingLinesThatWereFound);
            var currentMissingLines = _gpxLoopsSplitterExecutor.GetMissingLines(itmLine, lineStringsInArea, _options.MinimalMissingPartLength, _options.MinimalDistanceToClosestPoint);
            missingLinesSplit.AddRange(currentMissingLines);
        }
        return MergeBackLines(missingLinesSplit);
    }

    private List<LineString> SplitLine(LineString itmLineSting)
    {
        var splitLines = new List<LineString>();
        var numberOfDividesForPoints = (itmLineSting.Coordinates.Length - 1) / _options.MaxNumberOfPointsPerLine;
        var numberOfDividesForLength = (int)(itmLineSting.Length / _options.MaxLengthPerLine);
        var numberOfDivides = Math.Max(numberOfDividesForPoints, numberOfDividesForLength);
        if (numberOfDivides == 0)
        {
            splitLines.Add(itmLineSting);
            return splitLines;
        }
        var maxNumberOfPointsPerLine = Math.Max(1, (itmLineSting.Coordinates.Length - 1) / numberOfDivides);

        for (int segmentIndex = 0; segmentIndex <= numberOfDivides; segmentIndex++)
        {
            if (itmLineSting.Coordinates.Length - segmentIndex * maxNumberOfPointsPerLine <= 1)
            {
                continue;
            }
            var splitLineToAdd = _geometryFactory.CreateLineString(itmLineSting.Coordinates
                .Skip(segmentIndex * maxNumberOfPointsPerLine)
                .Take(maxNumberOfPointsPerLine + 1).ToArray());
            splitLines.Add(splitLineToAdd);
        }
        return splitLines;
    }

    private List<LineString> MergeBackLines(List<LineString> missingLines)
    {
        var mergedLines = new List<LineString>();
        if (!missingLines.Any())
        {
            return [];
        }
        var lineToAdd = missingLines.First();
        for (int lineIndex = 1; lineIndex < missingLines.Count; lineIndex++)
        {
            var currentLine = missingLines[lineIndex];
            var currentLineCoordinates = currentLine.Coordinates.ToList();
            var previousLineCoordinates = lineToAdd.Coordinates;
            if (currentLineCoordinates.First().Equals2D(previousLineCoordinates.Last()))
            {
                currentLineCoordinates.RemoveAt(0);
                lineToAdd = _geometryFactory.CreateLineString(previousLineCoordinates.Concat(currentLineCoordinates).ToArray());
            }
            else
            {
                mergedLines.Add(lineToAdd);
                lineToAdd = currentLine;
            }
        }
        mergedLines.Add(lineToAdd);
        return mergedLines;
    }

    private List<LineString> MergeLines(List<LineString> missingLines)
    {
        var mergedLines = new List<LineString>();
        while (missingLines.Any())
        {
            var missingLine = missingLines.First();
            missingLines.RemoveAt(0);
            var lineToAddTo = mergedLines.FirstOrDefault(l =>
                l.Coordinates.Last().Equals2D(missingLine.Coordinates.First()));
            if (lineToAddTo != null)
            {
                var index = mergedLines.IndexOf(lineToAddTo);
                mergedLines.RemoveAt(index);
                var mergedLine = _geometryFactory.CreateLineString(lineToAddTo.Coordinates.Concat(missingLine.Coordinates.Skip(1)).ToArray());
                mergedLines.Insert(index, mergedLine);
                continue;
            }
            lineToAddTo = mergedLines.FirstOrDefault(l =>
                l.Coordinates.First().Equals2D(missingLine.Coordinates.Last()));
            if (lineToAddTo != null)
            {
                var index = mergedLines.IndexOf(lineToAddTo);
                mergedLines.RemoveAt(index);
                var mergedLine = _geometryFactory.CreateLineString(missingLine.Coordinates.Concat(lineToAddTo.Coordinates.Skip(1)).ToArray());
                mergedLines.Insert(index, mergedLine);
                continue;
            }
            mergedLines.Add(missingLine);
        }
        return mergedLines;
    }

    private async Task<List<LineString>> GetLineStringsInArea(LineString gpxItmLine, double tolerance)
    {
        var northEast = _itmWgs84MathTransform.Transform(gpxItmLine.Coordinates.Max(c => c.X) + tolerance, gpxItmLine.Coordinates.Max(c => c.Y) + tolerance);
        var southWest = _itmWgs84MathTransform.Transform(gpxItmLine.Coordinates.Min(c => c.X) - tolerance, gpxItmLine.Coordinates.Min(c => c.Y) - tolerance);
        var ways = await _overpassGateway.GetHighways(new Coordinate(northEast.x, northEast.y), new Coordinate(southWest.x, southWest.y));
        var highways = _osmGeoJsonPreprocessorExecutor.Preprocess(ways);
        return highways.Select(highway => ToItmLineString(highway.Geometry.Coordinates, highway.GetOsmId())).ToList();
    }

    private LineString ToItmLineString(IEnumerable<Coordinate> coordinates, long id)
    {
        var itmCoordinates = coordinates.Select(c => _wgs84ItmMathTransform.Transform(c.X, c.Y))
            .Select(c => new Coordinate(Math.Round(c.x, 1), Math.Round(c.y, 1)))
            .ToArray();
        var line = _geometryFactory.CreateLineString(itmCoordinates);
        line.SetOsmId(id);
        return line;
    }

    private async Task<List<LineString>> ProlongLinesAccordingToOriginalGpx(List<LineString> linesToProlong, LineString gpxItmLine)
    {
        var originalCoordinates = gpxItmLine.Coordinates;
        var prolongInputs = new List<GpxProlongerExecutorInput>();
        var filteredOriginalCoordinates = new List<Coordinate>();
        foreach (var coordinate in originalCoordinates)
        {
            if (linesToProlong.Any(l => l.Distance(new Point(coordinate)) < _options.MaxProlongLineLength))
            {
                filteredOriginalCoordinates.Add(coordinate);
                if (!ReferenceEquals(coordinate, originalCoordinates.Last()))
                {
                    continue;
                }
            }
            var coordinates = filteredOriginalCoordinates.ToArray();
            if (coordinates.Length < 2)
            {
                continue;
            }
            prolongInputs.Insert(0, new GpxProlongerExecutorInput
            {
                OriginalCoordinates = coordinates,
                ExistingItmHighways = await GetExistingCloseLines(_geometryFactory.CreateLineString(coordinates)),
                MinimalDistance = _options.MaxDistanceToExistingLineForMerge,
                MinimalAreaSize = _options.MinimalAreaSize,
                MinimalLength = _options.MinimalProlongLineLength
            });
            filteredOriginalCoordinates.Clear();
        }
        foreach (var input in prolongInputs)
        {
            input.LinesToProlong = linesToProlong;
            linesToProlong = _gpxProlongerExecutor.Prolong(input);
        }
        return linesToProlong.Select(l => _geometryFactory.CreateLineString(l.Coordinates.Select(c => new Coordinate(Math.Round(c.X, 1), Math.Round(c.Y, 1))).ToArray())).ToList();
    }
        
    private List<LineString> AdjustIntersections(List<LineString> gpxItmLines)
    {
        var adjustedLines = new List<LineString>();

        for (int currentLineIndex = gpxItmLines.Count - 1; currentLineIndex >= 0; currentLineIndex--)
        {
            var currentLine = gpxItmLines[currentLineIndex];
            foreach (var otherLine in gpxItmLines.Except([currentLine]))
            {
                currentLine = GetLineWithExtraPoints(currentLine, otherLine.Coordinates.First());
                currentLine = GetLineWithExtraPoints(currentLine, otherLine.Coordinates.Last());
            }
            gpxItmLines[currentLineIndex] = currentLine;
        }
        foreach (var currentLine in gpxItmLines)
        {
            var currentCoordinates = currentLine.Coordinates.ToList();
            ReplaceEdgeIfNeeded(adjustedLines, currentCoordinates.First(), currentCoordinates);
            ReplaceEdgeIfNeeded(adjustedLines, currentCoordinates.Last(), currentCoordinates);
            adjustedLines.Add(_geometryFactory.CreateLineString(currentCoordinates.ToArray()));
        }
        return adjustedLines;
    }

    private LineString GetLineWithExtraPoints(LineString currentLine, Coordinate coordinateToAddIfNeeded)
    {
        var point = new Point(coordinateToAddIfNeeded);
        if (currentLine.Distance(point) >= _options.MaxDistanceToExistingLineForMerge * 2)
        {
            // coordinate not close enough
            return currentLine;
        }
        var closestCoordinateOnGpx = currentLine.Coordinates.OrderBy(c => c.Distance(coordinateToAddIfNeeded)).First();
        if (closestCoordinateOnGpx.Distance(coordinateToAddIfNeeded) < 2 * _options.MaxDistanceToExistingLineForMerge)
        {
            // line already has a close enough coordinate
            return currentLine;
        }
        // need to add a coordinate to the line
        var coordinates = currentLine.Coordinates.ToList();
        var line = new LocationIndexedLine(currentLine);
        var projectedLocation = line.Project(coordinateToAddIfNeeded);
        var coordinateToAdd = line.ExtractPoint(projectedLocation);
        coordinates.Insert(projectedLocation.SegmentIndex + 1, coordinateToAdd);
        return _geometryFactory.CreateLineString(coordinates.ToArray());
    }

    private void ReplaceEdgeIfNeeded(List<LineString> adjustedLines, Coordinate coordinate, List<Coordinate> currentCoordinates)
    {
        var coordinateReplacement = adjustedLines.SelectMany(l => l.Coordinates)
            .Where(c => c.Distance(coordinate) < 2 * _options.MaxDistanceToExistingLineForMerge)
            .OrderBy(c => c.Distance(coordinate))
            .FirstOrDefault();
        if (coordinateReplacement != null)
        {
            currentCoordinates[currentCoordinates.IndexOf(coordinate)] = coordinateReplacement;
        }
    }
}