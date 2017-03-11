using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using GeoAPI.CoordinateSystems.Transformations;
using GeoAPI.Geometries;
using IsraelHiking.API.Executors;
using IsraelHiking.Common;
using IsraelHiking.DataAccessInterfaces;
using NetTopologySuite.Geometries;
using NetTopologySuite.LinearReferencing;
using NetTopologySuite.Simplify;

namespace IsraelHiking.API.Services
{
    /// <inheritdoc/>
    public class AddibleGpxLinesFinderService : IAddibleGpxLinesFinderService
    {
        private readonly IGpxLoopsSplitterExecutor _gpxLoopsSplitterExecutor;
        private readonly IGpxProlongerExecutor _gpxProlongerExecutor;
        private readonly IMathTransform _itmWgs84MathTransfrom;
        private readonly IElasticSearchGateway _elasticSearchGateway;
        private readonly IGeometryFactory _geometryFactory;
        private readonly ILogger _logger;
        private readonly ConfigurationData _options;

        /// <summary>
        /// Constructor
        /// </summary>
        /// <param name="gpxLoopsSplitterExecutor"></param>
        /// <param name="gpxProlongerExecutor"></param>
        /// <param name="itmWgs84MathTransfrom"></param>
        /// <param name="elasticSearchGateway"></param>
        /// <param name="options"></param>
        /// <param name="geometryFactory"></param>
        /// <param name="logger"></param>
        public AddibleGpxLinesFinderService(IGpxLoopsSplitterExecutor gpxLoopsSplitterExecutor,
            IGpxProlongerExecutor gpxProlongerExecutor,
            IMathTransform itmWgs84MathTransfrom, 
            IElasticSearchGateway elasticSearchGateway, 
            IOptions<ConfigurationData> options,
            IGeometryFactory geometryFactory,
            ILogger logger)
        {
            _gpxLoopsSplitterExecutor = gpxLoopsSplitterExecutor;
            _gpxProlongerExecutor = gpxProlongerExecutor;
            _itmWgs84MathTransfrom = itmWgs84MathTransfrom;
            _elasticSearchGateway = elasticSearchGateway;
            _geometryFactory = geometryFactory;
            _logger = logger;
            _options = options.Value;
        }

        /// <inheritdoc/>
        public async Task<IEnumerable<ILineString>> GetLines(List<ILineString> gpxItmLines)
        {
            _logger.LogInformation($"Looking for unmapped routes started on {gpxItmLines.Count} traces");

            var linesToReturn = await FindMissingLines(gpxItmLines);
            linesToReturn = SplitSelfLoopsAndRemoveDuplication(linesToReturn);
            linesToReturn = SimplifyLines(linesToReturn);
            linesToReturn = await ProlongLinesEndAccordingToOriginalGpx(linesToReturn, gpxItmLines);
            linesToReturn = await ProlongLinesStartAccordingToOriginalGpx(linesToReturn, gpxItmLines);
            linesToReturn = MergeBackLines(linesToReturn); // after adding parts, possible merge options
            linesToReturn = SimplifyLines(linesToReturn); // need to simplify to remove sharp corners
            linesToReturn = AdjustIntersections(linesToReturn); // intersections may have moved after simplification

            _logger.LogInformation($"Looking for unmapped routes finished, found {linesToReturn.Count} routes.");
            return linesToReturn;
        }

        private List<ILineString> SplitSelfLoopsAndRemoveDuplication(List<ILineString> missingLines)
        {
            var missingLinesWithoutLoops = new List<ILineString>();
            foreach (var missingLine in missingLines)
            {
                missingLinesWithoutLoops.AddRange(_gpxLoopsSplitterExecutor.SplitSelfLoops(missingLine, _options.ClosestPointTolerance));
            }
            missingLinesWithoutLoops.Reverse(); // remove duplications set higher priority to lines that were recorded later
            var missingLinesWithoutLoopsAndDuplications = new List<ILineString>();
            foreach (var missingLineWithoutLoops in missingLinesWithoutLoops)
            {
                var linesToAdd = _gpxLoopsSplitterExecutor.GetMissingLines(missingLineWithoutLoops,
                    missingLinesWithoutLoopsAndDuplications.ToArray(),
                    _options.MinimalMissingSelfLoopPartLegth,
                    _options.ClosestPointTolerance);
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
                var simpleLine = DouglasPeuckerSimplifier.Simplify(lineSting, _options.SimplificationTolerance) as ILineString;
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

        private async Task<List<ILineString>> FindMissingLines(List<ILineString> gpxItmLines)
        {
            var missingLinesSplit = new List<ILineString>();
            var splitItmLines = SplitLines(gpxItmLines);
            foreach (var itmLine in splitItmLines)
            {
                var lineStringsInArea = await GetLineStringsInArea(itmLine, _options.ClosestPointTolerance);
                var currentMissingLines = _gpxLoopsSplitterExecutor.GetMissingLines(itmLine, lineStringsInArea, _options.MinimalMissingPartLength, _options.ClosestPointTolerance);
                missingLinesSplit.AddRange(currentMissingLines);
            }
            return MergeBackLines(missingLinesSplit);
        }

        private List<ILineString> SplitLines(List<ILineString> itmLineStings)
        {
            var splitLines = new List<ILineString>();
            foreach (var itmLineSting in itmLineStings)
            {   
                var numberOfDividesForPoints = (itmLineSting.Coordinates.Length - 1)/_options.MaxNumberOfPointsPerLine;
                var numberOfDividesForLength = (int)(itmLineSting.Length / _options.MaxLengthPerLine);
                var numberOfDivides = Math.Max(numberOfDividesForPoints, numberOfDividesForLength);
                if (numberOfDivides == 0)
                {
                    splitLines.Add(itmLineSting);
                    continue;
                }
                var maxNumberOfPointsPerLine = Math.Max(1, (itmLineSting.Coordinates.Length - 1)/ numberOfDivides);

                for (int segmentIndex = 0; segmentIndex <= numberOfDivides; segmentIndex++)
                {
                    if (itmLineSting.Coordinates.Length - segmentIndex*maxNumberOfPointsPerLine <= 1)
                    {
                        continue;
                    }
                    var splitLineToAdd = _geometryFactory.CreateLineString(itmLineSting.Coordinates
                        .Skip(segmentIndex* maxNumberOfPointsPerLine)
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

        private async Task<List<ILineString>> GetLineStringsInArea(ILineString gpxItmLine, double tolerance)
        {
            var northEast = _itmWgs84MathTransfrom.Transform(new Coordinate
            {
                Y = gpxItmLine.Coordinates.Max(c => c.Y) + tolerance,
                X = gpxItmLine.Coordinates.Max(c => c.X) + tolerance
            });
            var southWest = _itmWgs84MathTransfrom.Transform(new Coordinate
            {
                Y = gpxItmLine.Coordinates.Min(c => c.Y) - tolerance,
                X = gpxItmLine.Coordinates.Min(c => c.X) - tolerance
            });
            var highways = await _elasticSearchGateway.GetHighways(northEast, southWest);
            return highways.Select(highway => ToItmLineString(highway.Geometry.Coordinates, highway.Attributes["osm_id"].ToString())).ToList();
        }

        private ILineString ToItmLineString(IEnumerable<Coordinate> coordinates, string id)
        {
            var itmCoordinates = coordinates.Select(_itmWgs84MathTransfrom.Inverse().Transform).ToArray();
            var line = _geometryFactory.CreateLineString(itmCoordinates);
            line.SetOsmId(id);
            return line;
        }

        /// <summary>
        /// This method is try to prolong all lines according to original GPS trace.
        /// for each line it prolongs the end of the line.
        /// </summary>
        /// <param name="linesToProlong"></param>
        /// <param name="gpxItmLines"></param>
        /// <returns></returns>
        private async Task<List<ILineString>> ProlongLinesEndAccordingToOriginalGpx(List<ILineString> linesToProlong, List<ILineString> gpxItmLines)
        {
            var prolongedLines = new List<ILineString>();
            var currentLineIndex = gpxItmLines.Count - 1;
            var currentPositionIndex = gpxItmLines[currentLineIndex].Coordinates.Length - 1;
            for (int lineIndex = linesToProlong.Count - 1; lineIndex >= 0; lineIndex--)
            {
                var prolongedLine = linesToProlong[lineIndex];
                var currentCoordinate = prolongedLine.Coordinates.Last();
                UpdateIndexes(currentCoordinate, gpxItmLines, ref currentLineIndex, ref currentPositionIndex);
                var originalCoordinates = gpxItmLines[currentLineIndex].Coordinates.Skip(currentPositionIndex).ToArray();

                var lineStringInArea = await GetLineStringsInArea(new LineString(new[] {currentCoordinate, currentCoordinate}),
                            _options.MaximalProlongLineLength);
                prolongedLine = _gpxProlongerExecutor.ProlongLineEnd(prolongedLine,
                    originalCoordinates,
                    lineStringInArea.Concat(prolongedLines).Concat(linesToProlong.Take(lineIndex)).ToArray(),
                    _options.DistanceToExisitngLineMergeThreshold,
                    _options.MaximalProlongLineLength);

                prolongedLines.Add(prolongedLine);
            }
            prolongedLines.Reverse(); // reverse back to keep the original order of the lines
            return prolongedLines;
        }

        /// <summary>
        /// This method is try to prolong all lines according to original GPS trace.
        /// for each line it prolongs the start of the line unless the previous line was already prolonged to intersect it.
        /// </summary>
        /// <param name="linesToProlong"></param>
        /// <param name="gpxItmLines"></param>
        /// <returns></returns>
        private async Task<List<ILineString>> ProlongLinesStartAccordingToOriginalGpx(List<ILineString> linesToProlong, List<ILineString> gpxItmLines)
        {
            var prolongedLines = new List<ILineString>();
            var currentLineIndex = gpxItmLines.Count - 1;
            var currentPositionIndex = gpxItmLines[currentLineIndex].Coordinates.Length - 1;
            for (int lineIndex = linesToProlong.Count - 1; lineIndex >= 0; lineIndex--)
            {
                var prolongedLine = linesToProlong[lineIndex];
                var previousLineToProlong = lineIndex > 0 ? linesToProlong[lineIndex - 1] : null;
                if (previousLineToProlong != null && previousLineToProlong.Intersects(prolongedLine))
                {
                    prolongedLines.Add(prolongedLine);
                    continue;
                }
                var currentCoordinate = prolongedLine.Coordinates.First();
                UpdateIndexes(currentCoordinate, gpxItmLines, ref currentLineIndex, ref currentPositionIndex);
                var originalCoordinates = gpxItmLines[currentLineIndex].Coordinates.Take(currentPositionIndex + 1).ToArray();

                var lineStringInArea = await GetLineStringsInArea(new LineString(new[] { currentCoordinate, currentCoordinate }),
                            _options.MaximalProlongLineLength);
                var prolongedLineStart = _gpxProlongerExecutor.ProlongLineStart(prolongedLine,
                    originalCoordinates,
                    lineStringInArea.Concat(prolongedLines).Concat(linesToProlong.Take(lineIndex)).ToArray(),
                    _options.DistanceToExisitngLineMergeThreshold,
                    _options.MaximalProlongLineLength);

                    prolongedLines.Add(prolongedLineStart);
            }
            prolongedLines.Reverse(); // reverse back to keep the original order of the lines
            return prolongedLines;
        }

        private void UpdateIndexes(Coordinate currentCoordinate, List<ILineString> gpxItmLines, ref int currentLineIndex, ref int currentPositionIndex)
        {
            var lookupCoordinate = gpxItmLines[currentLineIndex].Coordinates[currentPositionIndex];
            var firstRound = true;
            while (!currentCoordinate.Equals2D(lookupCoordinate))
            {
                currentPositionIndex--;
                if (currentPositionIndex >= 0)
                {
                    lookupCoordinate = gpxItmLines[currentLineIndex].Coordinates[currentPositionIndex];
                    continue;
                }
                currentLineIndex--;
                if (currentLineIndex >= 0)
                {
                    currentPositionIndex = gpxItmLines[currentLineIndex].Coordinates.Length - 1;
                    lookupCoordinate = gpxItmLines[currentLineIndex].Coordinates[currentPositionIndex];
                    continue;
                }
                if (firstRound)
                {
                    currentLineIndex = gpxItmLines.Count - 1;
                    firstRound = false;
                    currentPositionIndex = gpxItmLines[currentLineIndex].Coordinates.Length - 1;
                    lookupCoordinate = gpxItmLines[currentLineIndex].Coordinates[currentPositionIndex];
                    continue;
                }
                currentLineIndex = gpxItmLines.Count - 1;
                currentPositionIndex = gpxItmLines[currentLineIndex].Coordinates.Length - 1;
                _logger.LogError("Can't find coordinate: " + currentCoordinate + " in lines: " + string.Join("\n", gpxItmLines.Select(l => l.ToString())));
                break;
            }
        }

        private List<ILineString> AdjustIntersections(List<ILineString> gpxItmLines)
        {
            var adjustedLines = new List<ILineString>();

            for (int currnetLineIndex = gpxItmLines.Count - 1; currnetLineIndex >= 0; currnetLineIndex--)
            {
                var currentLine = gpxItmLines[currnetLineIndex];
                for (int previousLineIndex = 0; previousLineIndex < currnetLineIndex; previousLineIndex++)
                {
                    var previousLine = gpxItmLines[previousLineIndex];
                    currentLine = GetLineWithExtraPoints(currentLine, previousLine.Coordinates.First());
                    currentLine = GetLineWithExtraPoints(currentLine, previousLine.Coordinates.Last());
                }
                var currentCoordinates = currentLine.Coordinates.ToList();
                ReplaceEdgeIfNeeded(adjustedLines, currentCoordinates.First(), currentCoordinates);
                ReplaceEdgeIfNeeded(adjustedLines, currentCoordinates.Last(), currentCoordinates);
                adjustedLines.Add(_geometryFactory.CreateLineString(currentCoordinates.ToArray()));
            }
            adjustedLines.Reverse(); // reverse back to keep the original order of the lines
            return adjustedLines;
        }

        private ILineString GetLineWithExtraPoints(ILineString currentLine, Coordinate coordinateToAddIfNeeded)
        {
            var point = new Point(coordinateToAddIfNeeded);
            if (currentLine.Distance(point) >= _options.DistanceToExisitngLineMergeThreshold)
            {
                // coordinate not close enough
                return currentLine;
            }
            var closestCoordinateOnGpx = currentLine.Coordinates.OrderBy(c => c.Distance(coordinateToAddIfNeeded)).First();
            if (closestCoordinateOnGpx.Distance(coordinateToAddIfNeeded) <
                _options.DistanceToExisitngLineMergeThreshold)
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
            return new LineString(coordinates.ToArray());
        }

        private void ReplaceEdgeIfNeeded(List<ILineString> adjustedLines, Coordinate coordinate, List<Coordinate> currentCoordinates)
        {
            var coordinateReplacement = adjustedLines.SelectMany(l => l.Coordinates)
                .Where(c => c.Distance(coordinate) < _options.DistanceToExisitngLineMergeThreshold)
                .OrderBy(c => c.Distance(coordinate))
                .FirstOrDefault();
            if (coordinateReplacement != null)
            {
                currentCoordinates[currentCoordinates.IndexOf(coordinate)] = coordinateReplacement;
            }
        }
    }
}
