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

        /// <summary>
        /// Constructor
        /// </summary>
        /// <param name="gpxLoopsSplitterExecutor"></param>
        /// <param name="gpxProlongerExecutor"></param>
        /// <param name="coordinatesConverter"></param>
        /// <param name="elasticSearchGateway"></param>
        /// <param name="configurationProvider"></param>

        public AddibleGpxLinesFinderService(IGpxLoopsSplitterExecutor gpxLoopsSplitterExecutor,
            IGpxProlongerExecutor gpxProlongerExecutor,
            ICoordinatesConverter coordinatesConverter, 
            IElasticSearchGateway elasticSearchGateway, 
            IConfigurationProvider configurationProvider)
        {
            _gpxLoopsSplitterExecutor = gpxLoopsSplitterExecutor;
            _gpxProlongerExecutor = gpxProlongerExecutor;
            _coordinatesConverter = coordinatesConverter;
            _elasticSearchGateway = elasticSearchGateway;
            _configurationProvider = configurationProvider;
        }

        /// <inheritdoc/>
        public async Task<IEnumerable<LineString>> GetLines(List<LineString> gpxItmLines)
        {
            var missingLines = await FindMissingLines(gpxItmLines);
            var linesToReturn = new List<LineString>();
            foreach (var missingLine in missingLines)
            {
                linesToReturn.AddRange(_gpxLoopsSplitterExecutor.SplitSelfLoops(missingLine, _configurationProvider.ClosestPointTolerance));
            }

            linesToReturn = RemoveDuplication(linesToReturn);
            linesToReturn = SimplifyLines(linesToReturn);
            linesToReturn = await ProlongLinesAccordingToOriginalGpx(linesToReturn, gpxItmLines);
            linesToReturn = MergeBackLines(linesToReturn); // after adding parts, possible merge options
            linesToReturn = SimplifyLines(linesToReturn); // need to simplify to remove sharp corners
            linesToReturn = AdjustIntersections(linesToReturn); // intersections may have moved after simplification
            return linesToReturn;

            //return await MergeLines(missingLinesWithoutLoopsAndDuplications);
        }

        private List<LineString> RemoveDuplication(List<LineString> missingLinesWithoutLoops)
        {
            var missingLinesWithoutLoopsAndDuplications = new List<LineString>();
            missingLinesWithoutLoops.Reverse(); // remove duplications set higher priority to lines that were recorded later
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

        private List<LineString> SimplifyLines(IEnumerable<LineString> lineStings)
        {
            var lines = new List<LineString>();
            foreach (var lineSting in lineStings)
            {
                var simpleLine = DouglasPeuckerSimplifier.Simplify(lineSting, _configurationProvider.SimplificationTolerance) as LineString;
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

        private async Task<List<LineString>> FindMissingLines(List<LineString> gpxItmLines)
        {
            var missingLinesSplit = new List<LineString>();
            var splitItmLines = SplitLinesByNumberOfPoints(gpxItmLines);
            foreach (var itmLine in splitItmLines)
            {
                var lineStringsInArea = await GetLineStringsInArea(itmLine);
                var currentMissingLines = _gpxLoopsSplitterExecutor.GetMissingLines(itmLine, lineStringsInArea, _configurationProvider.MinimalMissingPartLength, _configurationProvider.ClosestPointTolerance);
                missingLinesSplit.AddRange(currentMissingLines);
            }
            return MergeBackLines(missingLinesSplit);
        }

        private List<LineString> SplitLinesByNumberOfPoints(List<LineString> itmLineStings)
        {
            var splitLines = new List<LineString>();
            foreach (var itmLineSting in itmLineStings)
            {
                var numberOfDivides = (itmLineSting.Coordinates.Length - 1)/_configurationProvider.MaxNumberOfPointsPerLine;
                for (int segmentIndex = 0; segmentIndex <= numberOfDivides; segmentIndex++)
                {
                    var splitLineToAdd = new LineString(itmLineSting.Coordinates
                        .Skip(segmentIndex*_configurationProvider.MaxNumberOfPointsPerLine)
                        .Take(_configurationProvider.MaxNumberOfPointsPerLine + 1).ToArray());
                    splitLines.Add(splitLineToAdd);
                }
            }
            return splitLines;
        }

        private List<LineString> MergeBackLines(List<LineString> missingLines)
        {
            var mergedLines = new List<LineString>();
            if (!missingLines.Any())
            {
                return new List<LineString>();
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
                    lineToAdd = new LineString(previousLineCoordinates.Concat(currentLineCoordinates).ToArray());
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

        private async Task<List<LineString>> GetLineStringsInArea(LineString gpxLine)
        {
            var northEast = _coordinatesConverter.ItmToWgs84(new NorthEast
            {
                North = (int)(gpxLine.Coordinates.Max(c => c.Y) + _configurationProvider.ClosestPointTolerance),
                East = (int)(gpxLine.Coordinates.Max(c => c.X) + _configurationProvider.ClosestPointTolerance)
            });
            var southWest = _coordinatesConverter.ItmToWgs84(new NorthEast
            {
                North = (int)(gpxLine.Coordinates.Min(c => c.Y) - _configurationProvider.ClosestPointTolerance),
                East = (int)(gpxLine.Coordinates.Min(c => c.X) - _configurationProvider.ClosestPointTolerance)
            });
            var highways = await _elasticSearchGateway.GetHighways(new LatLng { lat = northEast.Latitude, lng = northEast.Longitude }, new LatLng { lat = southWest.Latitude, lng = southWest.Longitude });
            return highways.Select(highway => ToItmLineString(highway.Geometry.Coordinates)).ToList();
        }

        private LineString ToItmLineString(IEnumerable<Coordinate> coordinates)
        {
            var itmCoordinates = coordinates.Select(coordinate =>
            {
                var northEast = _coordinatesConverter.Wgs84ToItm(new LatLon { Longitude = coordinate.X, Latitude = coordinate.Y });
                return new Coordinate(northEast.East, northEast.North);
            }).ToArray();
            return new LineString(itmCoordinates);
        }

        private async Task<List<LineString>> ProlongLinesAccordingToOriginalGpx(List<LineString> linesToProlong, List<LineString> gpxItmLines)
        {
            var prolongedLines = new List<LineString>();
            var currentLineIndex = gpxItmLines.Count - 1;
            var currentPositionIndex = gpxItmLines[currentLineIndex].Coordinates.Length - 1;
            for (int lineIndex = linesToProlong.Count - 1; lineIndex >= 0; lineIndex--)
            {
                var prolongedLine = linesToProlong[lineIndex];
                // end
                var currentCoordinate = prolongedLine.Coordinates.Last();
                UpdateIndexes(currentCoordinate, gpxItmLines, ref currentLineIndex, ref currentPositionIndex);
                var lineStringInArea = await GetLineStringsInArea(new LineString(new[] {currentCoordinate, currentCoordinate}));
                var originalCoordinates = gpxItmLines[currentLineIndex].Coordinates.Skip(currentPositionIndex).ToArray();
                prolongedLine = _gpxProlongerExecutor.ProlongLineEnd(prolongedLine,
                    originalCoordinates,
                    lineStringInArea.Concat(prolongedLines).Concat(linesToProlong.Take(lineIndex)).ToArray(),
                    _configurationProvider.DistanceToExisitngLineMergeThreshold,
                    _configurationProvider.MaximalProlongLineLength);
                // start
                currentCoordinate = prolongedLine.Coordinates.First();
                UpdateIndexes(currentCoordinate, gpxItmLines, ref currentLineIndex, ref currentPositionIndex);
                lineStringInArea =
                    await GetLineStringsInArea(new LineString(new[] {currentCoordinate, currentCoordinate}));
                originalCoordinates = gpxItmLines[currentLineIndex].Coordinates.Take(currentPositionIndex + 1).ToArray();
                prolongedLine = _gpxProlongerExecutor.ProlongLineStart(prolongedLine,
                    originalCoordinates,
                    lineStringInArea.Concat(prolongedLines).Concat(linesToProlong.Take(lineIndex)).ToArray(), 
                    _configurationProvider.DistanceToExisitngLineMergeThreshold,
                    _configurationProvider.MaximalProlongLineLength);

                prolongedLines.Add(prolongedLine);
            }
            prolongedLines.Reverse();
            return prolongedLines;
        }

        private void UpdateIndexes(Coordinate currentCoordinate, List<LineString> gpxItmLines, ref int currentLineIndex, ref int currentPositionIndex)
        {
            var lookupCoordinate = gpxItmLines[currentLineIndex].Coordinates[currentPositionIndex];
            while (!currentCoordinate.Equals2D(lookupCoordinate))
            {
                currentPositionIndex--;
                if (currentPositionIndex < 0)
                {
                    currentLineIndex--;
                    currentPositionIndex = gpxItmLines[currentLineIndex].Coordinates.Length - 1;
                }
                lookupCoordinate = gpxItmLines[currentLineIndex].Coordinates[currentPositionIndex];
            }
        }

        private List<LineString> AdjustIntersections(List<LineString> gpxItmLines)
        {
            var adjustedLines = new List<LineString>();

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
                adjustedLines.Add(new LineString(currentCoordinates.ToArray()));
            }
            return adjustedLines;
        }

        private LineString GetLineWithExtraPoints(LineString currentLine, Coordinate coordinateToAddIfNeeded)
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

        private void ReplaceEdgeIfNeeded(List<LineString> adjustedLines, Coordinate coordinate, List<Coordinate> currentCoordinates)
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
