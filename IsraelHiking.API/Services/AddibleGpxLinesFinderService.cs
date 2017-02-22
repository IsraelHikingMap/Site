using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using GeoAPI.Geometries;
using IsraelHiking.API.Executors;
using IsraelHiking.Common;
using IsraelHiking.DataAccessInterfaces;
using IsraelTransverseMercator;
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
        private readonly ICoordinatesConverter _coordinatesConverter;
        private readonly IElasticSearchGateway _elasticSearchGateway;
        private readonly IConfigurationProvider _configurationProvider;
        private readonly IGeometryFactory _geometryFactory;
        private readonly ILogger _logger;

        /// <summary>
        /// Constructor
        /// </summary>
        /// <param name="gpxLoopsSplitterExecutor"></param>
        /// <param name="gpxProlongerExecutor"></param>
        /// <param name="coordinatesConverter"></param>
        /// <param name="elasticSearchGateway"></param>
        /// <param name="configurationProvider"></param>
        /// <param name="geometryFactory"></param>
        /// <param name="logger"></param>
        public AddibleGpxLinesFinderService(IGpxLoopsSplitterExecutor gpxLoopsSplitterExecutor,
            IGpxProlongerExecutor gpxProlongerExecutor,
            ICoordinatesConverter coordinatesConverter, 
            IElasticSearchGateway elasticSearchGateway, 
            IConfigurationProvider configurationProvider,
            IGeometryFactory geometryFactory,
            ILogger logger)
        {
            _gpxLoopsSplitterExecutor = gpxLoopsSplitterExecutor;
            _gpxProlongerExecutor = gpxProlongerExecutor;
            _coordinatesConverter = coordinatesConverter;
            _elasticSearchGateway = elasticSearchGateway;
            _configurationProvider = configurationProvider;
            _geometryFactory = geometryFactory;
            _logger = logger;
        }

        /// <inheritdoc/>
        public async Task<IEnumerable<ILineString>> GetLines(List<ILineString> gpxItmLines)
        {
            _logger.Info($"Looking for unmapped routes started on {gpxItmLines.Count} traces");
            var linesToReturn = await FindMissingLines(gpxItmLines);

            linesToReturn = SplitSelfLoopsAndRemoveDuplication(linesToReturn);
            linesToReturn = SimplifyLines(linesToReturn);
            linesToReturn = await ProlongLinesAccordingToOriginalGpx(linesToReturn, gpxItmLines);
            linesToReturn = MergeBackLines(linesToReturn); // after adding parts, possible merge options
            linesToReturn = SimplifyLines(linesToReturn); // need to simplify to remove sharp corners
            linesToReturn = AdjustIntersections(linesToReturn); // intersections may have moved after simplification

            _logger.Info($"Looking for unmapped routes finished, found {linesToReturn.Count} routes.");
            return linesToReturn;
        }

        private List<ILineString> SplitSelfLoopsAndRemoveDuplication(List<ILineString> missingLines)
        {
            var missingLinesWithoutLoops = new List<ILineString>();
            foreach (var missingLine in missingLines)
            {
                missingLinesWithoutLoops.AddRange(_gpxLoopsSplitterExecutor.SplitSelfLoops(missingLine, _configurationProvider.ClosestPointTolerance));
            }
            missingLinesWithoutLoops.Reverse(); // remove duplications set higher priority to lines that were recorded later
            var missingLinesWithoutLoopsAndDuplications = new List<ILineString>();
            foreach (var missingLineWithoutLoops in missingLinesWithoutLoops)
            {
                var linesToAdd = _gpxLoopsSplitterExecutor.GetMissingLines(missingLineWithoutLoops,
                    missingLinesWithoutLoopsAndDuplications.ToArray(),
                    _configurationProvider.MinimalMissingSelfLoopPartLegth,
                    _configurationProvider.ClosestPointTolerance);
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
                var simpleLine = DouglasPeuckerSimplifier.Simplify(lineSting, _configurationProvider.SimplificationTolerance) as ILineString;
                if (simpleLine == null)
                {
                    continue;
                }
                simpleLine = RadialDistanceByAngleSimplifier.Simplify(simpleLine, _configurationProvider.MinimalMissingSelfLoopPartLegth, _configurationProvider.RadialSimplificationAngle);
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
            var splitItmLines = SplitLinesByNumberOfPoints(gpxItmLines);
            foreach (var itmLine in splitItmLines)
            {
                var lineStringsInArea = await GetLineStringsInArea(itmLine, _configurationProvider.ClosestPointTolerance);
                var currentMissingLines = _gpxLoopsSplitterExecutor.GetMissingLines(itmLine, lineStringsInArea, _configurationProvider.MinimalMissingPartLength, _configurationProvider.ClosestPointTolerance);
                missingLinesSplit.AddRange(currentMissingLines);
            }
            return MergeBackLines(missingLinesSplit);
        }

        private List<ILineString> SplitLinesByNumberOfPoints(List<ILineString> itmLineStings)
        {
            var splitLines = new List<ILineString>();
            foreach (var itmLineSting in itmLineStings)
            {
                var numberOfDivides = (itmLineSting.Coordinates.Length - 1)/_configurationProvider.MaxNumberOfPointsPerLine;
                for (int segmentIndex = 0; segmentIndex <= numberOfDivides; segmentIndex++)
                {
                    var splitLineToAdd = _geometryFactory.CreateLineString(itmLineSting.Coordinates
                        .Skip(segmentIndex*_configurationProvider.MaxNumberOfPointsPerLine)
                        .Take(_configurationProvider.MaxNumberOfPointsPerLine + 1).ToArray());
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
            var northEast = _coordinatesConverter.ItmToWgs84(new NorthEast
            {
                North = (int)(gpxItmLine.Coordinates.Max(c => c.Y) + tolerance),
                East = (int)(gpxItmLine.Coordinates.Max(c => c.X) + tolerance)
            });
            var southWest = _coordinatesConverter.ItmToWgs84(new NorthEast
            {
                North = (int)(gpxItmLine.Coordinates.Min(c => c.Y) - tolerance),
                East = (int)(gpxItmLine.Coordinates.Min(c => c.X) - tolerance)
            });
            var highways = await _elasticSearchGateway.GetHighways(new LatLng { lat = northEast.Latitude, lng = northEast.Longitude }, new LatLng { lat = southWest.Latitude, lng = southWest.Longitude });
            return highways.Select(highway => ToItmLineString(highway.Geometry.Coordinates, highway.Attributes["osm_id"].ToString())).ToList();
        }

        private ILineString ToItmLineString(IEnumerable<Coordinate> coordinates, string id)
        {
            var itmCoordinates = coordinates.Select(coordinate =>
            {
                var northEast = _coordinatesConverter.Wgs84ToItm(new LatLon { Longitude = coordinate.X, Latitude = coordinate.Y });
                return new Coordinate(northEast.East, northEast.North);
            }).ToArray();
            var line = _geometryFactory.CreateLineString(itmCoordinates);
            line.SetOsmId(id);
            return line;
        }

        /// <summary>
        /// This method is try to prolong all lines according to original GPS trace.
        /// for each line it prolongs the end of the line
        /// it checks if it's better to prolong the previous line end or the current line start and prolongs accordingly.
        /// </summary>
        /// <param name="linesToProlong"></param>
        /// <param name="gpxItmLines"></param>
        /// <returns></returns>
        private async Task<List<ILineString>> ProlongLinesAccordingToOriginalGpx(List<ILineString> linesToProlong, List<ILineString> gpxItmLines)
        {
            var prolongedLines = new List<ILineString>();
            var currentLineIndex = gpxItmLines.Count - 1;
            var currentPositionIndex = gpxItmLines[currentLineIndex].Coordinates.Length - 1;
            for (int lineIndex = linesToProlong.Count - 1; lineIndex >= 0; lineIndex--)
            {
                var prolongedLine = linesToProlong[lineIndex];
                var previousLineToProlong = lineIndex > 0 ? linesToProlong[lineIndex - 1] : null;
                // prolong end
                var currentCoordinate = prolongedLine.Coordinates.Last();
                UpdateIndexes(currentCoordinate, gpxItmLines, ref currentLineIndex, ref currentPositionIndex);
                var originalCoordinates = gpxItmLines[currentLineIndex].Coordinates.Skip(currentPositionIndex).ToArray();

                var lineStringInArea = await GetLineStringsInArea(new LineString(new[] {currentCoordinate, currentCoordinate}),
                            _configurationProvider.MaximalProlongLineLength);
                prolongedLine = _gpxProlongerExecutor.ProlongLineEnd(prolongedLine,
                    originalCoordinates,
                    lineStringInArea.Concat(prolongedLines).Concat(linesToProlong.Take(lineIndex)).ToArray(),
                    _configurationProvider.DistanceToExisitngLineMergeThreshold,
                    _configurationProvider.MaximalProlongLineLength);
                // prolong start 
                currentCoordinate = prolongedLine.Coordinates.First();
                UpdateIndexes(currentCoordinate, gpxItmLines, ref currentLineIndex, ref currentPositionIndex);
                originalCoordinates = gpxItmLines[currentLineIndex].Coordinates.Take(currentPositionIndex + 1).ToArray();

                lineStringInArea = await GetLineStringsInArea(new LineString(new[] {currentCoordinate, currentCoordinate}),
                            _configurationProvider.MaximalProlongLineLength);
                var prolongedLineStart = _gpxProlongerExecutor.ProlongLineStart(prolongedLine,
                    originalCoordinates,
                    lineStringInArea.Concat(prolongedLines).Concat(linesToProlong.Take(lineIndex)).ToArray(),
                    _configurationProvider.DistanceToExisitngLineMergeThreshold,
                    _configurationProvider.MaximalProlongLineLength);

                if (previousLineToProlong == null)
                {
                    prolongedLines.Add(prolongedLineStart);
                    continue;
                }
                // prolong end of previous line
                currentCoordinate = previousLineToProlong.Coordinates.Last();
                UpdateIndexes(currentCoordinate, gpxItmLines, ref currentLineIndex, ref currentPositionIndex);
                originalCoordinates = gpxItmLines[currentLineIndex].Coordinates.Skip(currentPositionIndex).ToArray();

                lineStringInArea = await GetLineStringsInArea(new LineString(new[] { currentCoordinate, currentCoordinate }),
                            _configurationProvider.MaximalProlongLineLength);
                previousLineToProlong = _gpxProlongerExecutor.ProlongLineEnd(previousLineToProlong,
                    originalCoordinates,
                    lineStringInArea.Concat(prolongedLines).Concat(linesToProlong.Take(lineIndex - 1)).Concat(new [] { prolongedLine }).ToArray(),
                    _configurationProvider.DistanceToExisitngLineMergeThreshold,
                    _configurationProvider.MaximalProlongLineLength);

                if (previousLineToProlong.Coordinates.Last().Equals2D(prolongedLine.Coordinates.First()))
                {
                    // adds the prolonged line without prolonging the start
                    prolongedLines.Add(prolongedLine);
                }
                else
                {
                    // adds the prolonged line while prolonging the start
                    prolongedLines.Add(prolongedLineStart);
                }
            }
            // lines were added from end to begginging, reversing them to keep them in the original order.
            prolongedLines.Reverse();
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
                _logger.Error("Can't find coordinate: " + currentCoordinate + " in lines: " + string.Join("\n", gpxItmLines.Select(l => l.ToString())));
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
            return adjustedLines;
        }

        private ILineString GetLineWithExtraPoints(ILineString currentLine, Coordinate coordinateToAddIfNeeded)
        {
            var point = new Point(coordinateToAddIfNeeded);
            if (currentLine.Distance(point) >= _configurationProvider.DistanceToExisitngLineMergeThreshold)
            {
                // coordinate not close enough
                return currentLine;
            }
            var closestCoordinateOnGpx = currentLine.Coordinates.OrderBy(c => c.Distance(coordinateToAddIfNeeded)).First();
            if (closestCoordinateOnGpx.Distance(coordinateToAddIfNeeded) <
                _configurationProvider.DistanceToExisitngLineMergeThreshold)
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
                .Where(c => c.Distance(coordinate) < _configurationProvider.DistanceToExisitngLineMergeThreshold)
                .OrderBy(c => c.Distance(coordinate))
                .FirstOrDefault();
            if (coordinateReplacement != null)
            {
                currentCoordinates[currentCoordinates.IndexOf(coordinate)] = coordinateReplacement;
            }
        }
    }
}
