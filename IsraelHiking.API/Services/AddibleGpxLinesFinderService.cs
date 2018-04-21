using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using GeoAPI.CoordinateSystems.Transformations;
using GeoAPI.Geometries;
using IsraelHiking.API.Executors;
using IsraelHiking.Common;
using IsraelHiking.Common.Extensions;
using IsraelHiking.DataAccessInterfaces;
using NetTopologySuite.Geometries;
using NetTopologySuite.LinearReferencing;
using NetTopologySuite.Simplify;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;

namespace IsraelHiking.API.Services
{
    /// <inheritdoc/>
    public class AddibleGpxLinesFinderService : IAddibleGpxLinesFinderService
    {
        private readonly IGpxLoopsSplitterExecutor _gpxLoopsSplitterExecutor;
        private readonly IGpxProlongerExecutor _gpxProlongerExecutor;
        private readonly IMathTransform _itmWgs84MathTransform;
        private readonly IMathTransform _wgs84ItmMathTransform;
        private readonly IElasticSearchGateway _elasticSearchGateway;
        private readonly IGeometryFactory _geometryFactory;
        private readonly ILogger _logger;
        private readonly ConfigurationData _options;

        /// <summary>
        /// Constructor
        /// </summary>
        /// <param name="gpxLoopsSplitterExecutor"></param>
        /// <param name="gpxProlongerExecutor"></param>
        /// <param name="itmWgs84MathTransfromFactory"></param>
        /// <param name="elasticSearchGateway"></param>
        /// <param name="options"></param>
        /// <param name="geometryFactory"></param>
        /// <param name="logger"></param>
        public AddibleGpxLinesFinderService(IGpxLoopsSplitterExecutor gpxLoopsSplitterExecutor,
            IGpxProlongerExecutor gpxProlongerExecutor,
            IItmWgs84MathTransfromFactory itmWgs84MathTransfromFactory,
            IElasticSearchGateway elasticSearchGateway,
            IOptions<ConfigurationData> options,
            IGeometryFactory geometryFactory,
            ILogger logger)
        {
            _gpxLoopsSplitterExecutor = gpxLoopsSplitterExecutor;
            _gpxProlongerExecutor = gpxProlongerExecutor;
            _itmWgs84MathTransform = itmWgs84MathTransfromFactory.Create();
            _wgs84ItmMathTransform = itmWgs84MathTransfromFactory.CreateInverse();
            _elasticSearchGateway = elasticSearchGateway;
            _geometryFactory = geometryFactory;
            _logger = logger;
            _options = options.Value;
        }

        /// <inheritdoc/>
        public async Task<IEnumerable<ILineString>> GetLines(List<ILineString> gpxItmLines)
        {
            _logger.LogInformation($"Looking for unmapped routes started on {gpxItmLines.Count} traces");
            gpxItmLines = IncreaseGpxDensity(gpxItmLines);
            var linesToReturn = await FindMissingLines(gpxItmLines);
            linesToReturn = SplitSelfLoopsAndRemoveDuplication(linesToReturn);
            linesToReturn = SimplifyLines(linesToReturn);
            linesToReturn = await ProlongLinesAccordingToOriginalGpx(linesToReturn, gpxItmLines);
            linesToReturn = MergeLines(linesToReturn); 
            linesToReturn = SimplifyLines(linesToReturn); // need to simplify to remove sharp corners
            linesToReturn = AdjustIntersections(linesToReturn); // intersections may have moved after simplification
            linesToReturn = MergeLines(linesToReturn); // after adjusting intersections, possible merge options

            _logger.LogInformation($"Looking for unmapped routes finished, found {linesToReturn.Count} routes.");
            return linesToReturn;
        }

        private List<ILineString> IncreaseGpxDensity(List<ILineString> gpxItmLines)
        {
            var denseGpxLines = new List<ILineString>();
            foreach (var gpxItmLine in gpxItmLines.Where(l => l.Coordinates.Length > 0))
            {
                var coordinates = gpxItmLine.Coordinates.ToList();
                for (int coordinateIndex = 0; coordinateIndex < coordinates.Count - 1; coordinateIndex++)
                {
                    var currentCoordinate = coordinates[coordinateIndex];
                    var nextCoordinate = coordinates[coordinateIndex + 1];
                    if (currentCoordinate.Distance(nextCoordinate) > 2 * _options.MaxDistanceToExisitngLineForMerge)
                    {
                        var directionSegment = new LineSegment(currentCoordinate, nextCoordinate);
                        var coordinate = directionSegment.PointAlong((_options.MaxDistanceToExisitngLineForMerge) /( 2.0 * directionSegment.Length ));
                        coordinates.Insert(coordinateIndex + 1, coordinate);
                    }
                    else if (currentCoordinate.Distance(nextCoordinate) > _options.MaxDistanceToExisitngLineForMerge)
                    {
                        var middle = new Coordinate((currentCoordinate.X + nextCoordinate.X) / 2.0, (currentCoordinate.Y + nextCoordinate.Y) / 2.0);
                        coordinates.Insert(coordinateIndex + 1, middle);
                    }
                }
                denseGpxLines.Add(_geometryFactory.CreateLineString(coordinates.ToArray()));
            }
            return denseGpxLines;
        }

        private List<ILineString> SplitSelfLoopsAndRemoveDuplication(List<ILineString> missingLines)
        {
            var missingLinesWithoutLoops = new List<ILineString>();
            foreach (var missingLine in missingLines)
            {
                missingLinesWithoutLoops.AddRange(_gpxLoopsSplitterExecutor.SplitSelfLoops(missingLine, _options.MinimalDistanceToClosestPoint));
            }
            missingLinesWithoutLoops.Reverse(); // remove duplications set higher priority to lines that were recorded later
            var missingLinesWithoutLoopsAndDuplications = new List<ILineString>();
            foreach (var missingLineWithoutLoops in missingLinesWithoutLoops)
            {
                var linesToAdd = _gpxLoopsSplitterExecutor.GetMissingLines(missingLineWithoutLoops,
                    missingLinesWithoutLoopsAndDuplications.ToArray(),
                    _options.MinimalMissingSelfLoopPartLegth,
                    _options.MinimalDistanceToClosestPoint);
                linesToAdd.Reverse();
                missingLinesWithoutLoopsAndDuplications.AddRange(linesToAdd);
            }
            missingLinesWithoutLoopsAndDuplications.Reverse(); // reverse back to keep the original order of the lines
            return missingLinesWithoutLoopsAndDuplications;
        }

        private List<ILineString> SimplifyLines(IEnumerable<ILineString> lineStings)
        {
            var lines = new List<ILineString>();
            foreach (var lineSting in lineStings)
            {
                var simpleLine = DouglasPeuckerSimplifier.Simplify(lineSting, _options.SimplificationDistanceTolerance) as ILineString;
                if (simpleLine == null)
                {
                    continue;
                }
                simpleLine = RadialDistanceByAngleSimplifier.Simplify(simpleLine, _options.MinimalMissingSelfLoopPartLegth, _options.RadialSimplificationAngle);
                if (simpleLine == null)
                {
                    continue;
                }
                lines.Add(simpleLine);
            }
            return lines;
        }

        private async Task<List<ILineString>> GetExistingCloseLines(List<ILineString> gpxItmLines)
        {
            var existingLines = new List<ILineString>();
            var splitItmLines = SplitLines(gpxItmLines);
            foreach (var itmLine in splitItmLines)
            {
                var lineStringsInArea = await GetLineStringsInArea(itmLine, _options.MinimalDistanceToClosestPoint);
                existingLines.AddRange(lineStringsInArea.Where(l => l.Distance(itmLine) < _options.MinimalDistanceToClosestPoint));
            }
            return existingLines.GroupBy(l => l.GetOsmId()).Select(g => g.First()).ToList();
        }

        private async Task<List<ILineString>> FindMissingLines(List<ILineString> gpxItmLines)
        {
            var missingLinesSplit = new List<ILineString>();
            var splitItmLines = SplitLines(gpxItmLines);
            foreach (var itmLine in splitItmLines)
            {
                var lineStringsInArea = await GetLineStringsInArea(itmLine, _options.MinimalDistanceToClosestPoint);
                var currentMissingLines = _gpxLoopsSplitterExecutor.GetMissingLines(itmLine, lineStringsInArea, _options.MinimalMissingPartLength, _options.MinimalDistanceToClosestPoint);
                missingLinesSplit.AddRange(currentMissingLines);
            }
            return MergeBackLines(missingLinesSplit);
        }

        private List<ILineString> SplitLines(List<ILineString> itmLineStings)
        {
            var splitLines = new List<ILineString>();
            foreach (var itmLineSting in itmLineStings)
            {
                var numberOfDividesForPoints = (itmLineSting.Coordinates.Length - 1) / _options.MaxNumberOfPointsPerLine;
                var numberOfDividesForLength = (int)(itmLineSting.Length / _options.MaxLengthPerLine);
                var numberOfDivides = Math.Max(numberOfDividesForPoints, numberOfDividesForLength);
                if (numberOfDivides == 0)
                {
                    splitLines.Add(itmLineSting);
                    continue;
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
            }
            return splitLines;
        }

        private List<ILineString> MergeBackLines(List<ILineString> missingLines)
        {
            var mergedLines = new List<ILineString>();
            if (!missingLines.Any())
            {
                return new List<ILineString>();
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

        private List<ILineString> MergeLines(List<ILineString> missingLines)
        {
            var mergedLines = new List<ILineString>();
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

        private async Task<List<ILineString>> GetLineStringsInArea(ILineString gpxItmLine, double tolerance)
        {
            var northEast = _itmWgs84MathTransform.Transform(new Coordinate
            {
                Y = gpxItmLine.Coordinates.Max(c => c.Y) + tolerance,
                X = gpxItmLine.Coordinates.Max(c => c.X) + tolerance
            });
            var southWest = _itmWgs84MathTransform.Transform(new Coordinate
            {
                Y = gpxItmLine.Coordinates.Min(c => c.Y) - tolerance,
                X = gpxItmLine.Coordinates.Min(c => c.X) - tolerance
            });
            var highways = await _elasticSearchGateway.GetHighways(northEast, southWest);
            return highways.Select(highway => ToItmLineString(highway.Geometry.Coordinates, highway.GetOsmId())).ToList();
        }

        private ILineString ToItmLineString(IEnumerable<Coordinate> coordinates, string id)
        {
            var itmCoordinates = coordinates.Select(_wgs84ItmMathTransform.Transform).ToArray();
            var line = _geometryFactory.CreateLineString(itmCoordinates);
            line.SetOsmId(id);
            return line;
        }

        private async Task<List<ILineString>> ProlongLinesAccordingToOriginalGpx(List<ILineString> linesToProlong, List<ILineString> gpxItmLines)
        {
            var originalCoordinates = gpxItmLines.SelectMany(l => l.Coordinates).ToArray();
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
                    ExistingItmHighways = await GetExistingCloseLines(new List<ILineString> { _geometryFactory.CreateLineString(coordinates) }),
                    MinimalDistance = _options.MaxDistanceToExisitngLineForMerge,
                    MinimalAreaSize = _options.MinimalAreaSize
                });
                filteredOriginalCoordinates.Clear();
            }
            foreach (var input in prolongInputs)
            {
                input.LinesToProlong = linesToProlong;
                linesToProlong = _gpxProlongerExecutor.Prolong(input);
            }
            return linesToProlong;
        }
        
        private List<ILineString> AdjustIntersections(List<ILineString> gpxItmLines)
        {
            var adjustedLines = new List<ILineString>();

            for (int currnetLineIndex = gpxItmLines.Count - 1; currnetLineIndex >= 0; currnetLineIndex--)
            {
                var currentLine = gpxItmLines[currnetLineIndex];
                foreach (var otherLine in gpxItmLines.Except(new[] {currentLine}))
                {
                    currentLine = GetLineWithExtraPoints(currentLine, otherLine.Coordinates.First());
                    currentLine = GetLineWithExtraPoints(currentLine, otherLine.Coordinates.Last());
                }
                gpxItmLines[currnetLineIndex] = currentLine;
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

        private ILineString GetLineWithExtraPoints(ILineString currentLine, Coordinate coordinateToAddIfNeeded)
        {
            var point = new Point(coordinateToAddIfNeeded);
            if (currentLine.Distance(point) >= _options.MaxDistanceToExisitngLineForMerge * 2)
            {
                // coordinate not close enough
                return currentLine;
            }
            var closestCoordinateOnGpx = currentLine.Coordinates.OrderBy(c => c.Distance(coordinateToAddIfNeeded)).First();
            if (closestCoordinateOnGpx.Distance(coordinateToAddIfNeeded) < 2 * _options.MaxDistanceToExisitngLineForMerge)
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

        private void ReplaceEdgeIfNeeded(List<ILineString> adjustedLines, Coordinate coordinate, List<Coordinate> currentCoordinates)
        {
            var coordinateReplacement = adjustedLines.SelectMany(l => l.Coordinates)
                .Where(c => c.Distance(coordinate) < 2 * _options.MaxDistanceToExisitngLineForMerge)
                .OrderBy(c => c.Distance(coordinate))
                .FirstOrDefault();
            if (coordinateReplacement != null)
            {
                currentCoordinates[currentCoordinates.IndexOf(coordinate)] = coordinateReplacement;
            }
        }
    }
}
