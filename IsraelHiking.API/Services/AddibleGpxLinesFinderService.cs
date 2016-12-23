using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;
using GeoAPI.Geometries;
using IsraelHiking.Common;
using IsraelHiking.DataAccessInterfaces;
using IsraelTransverseMercator;
using NetTopologySuite.Geometries;
using NetTopologySuite.Simplify;

namespace IsraelHiking.API.Services
{
    public class AddibleGpxLinesFinderService : IAddibleGpxLinesFinderService
    {
        private const double CLOSEST_POINT_TOLERANCE = 30; // meters
        private const double SIMPLIFICATION_TOLERANCE = 5; // meters
        private const double MINIMAL_MISSING_PART_LENGTH = 200; // meters
        private const double MINIMAL_MISSING_SELF_LOOP_PART_LENGTH = CLOSEST_POINT_TOLERANCE; // meters
        private const int MAX_NUMBER_OF_POINTS_PER_LINE = 1000;

        private readonly IGpxLoopsSplitterService _gpxLoopsSplitterService;
        private readonly ICoordinatesConverter _coordinatesConverter;
        private readonly IElasticSearchGateway _elasticSearchGateway;

        public AddibleGpxLinesFinderService(IGpxLoopsSplitterService gpxLoopsSplitterService, 
            ICoordinatesConverter coordinatesConverter, 
            IElasticSearchGateway elasticSearchGateway)
        {
            _gpxLoopsSplitterService = gpxLoopsSplitterService;
            _coordinatesConverter = coordinatesConverter;
            _elasticSearchGateway = elasticSearchGateway;
        }

        /// <summary>
        /// This method does the following to every line:
        /// 1. removed all the points that are close to existing lines from OSM (stored in the ES database)
        /// 2. Split the remaining lines so that after the split there are no self loops in each line
        /// 3. remove duplicate lines (caused by splitting self loops)
        /// 4. Simplify lines using Douglas-Peucker and Radial angle simlifires
        /// 5. Merge the lines back if possible
        /// </summary>
        /// <param name="gpxLines">The lines to manipulate</param>
        /// <returns>The lines after manupulation</returns>
        public async Task<IEnumerable<LineString>> GetLines(List<LineString> gpxLines)
        {
            var missingLines = await FindMissingLines(gpxLines);
            var missingLinesWithoutLoops = new List<LineString>();
            foreach (var missingLine in missingLines)
            {
                missingLinesWithoutLoops.AddRange(_gpxLoopsSplitterService.SplitSelfLoops(missingLine, CLOSEST_POINT_TOLERANCE));
            }
            missingLinesWithoutLoops.Reverse();
            var missingLinesWithoutLoopsAndDuplications = new List<LineString>();
            for (int index = 0; index < missingLinesWithoutLoops.Count; index++)
            {
                var missingLineWithoutLoops = missingLinesWithoutLoops[index];
                missingLinesWithoutLoopsAndDuplications.AddRange(_gpxLoopsSplitterService.GetMissingLines(missingLineWithoutLoops, missingLinesWithoutLoops.Take(index).ToArray(), MINIMAL_MISSING_SELF_LOOP_PART_LENGTH, CLOSEST_POINT_TOLERANCE));
            }
            missingLinesWithoutLoopsAndDuplications.Reverse();
            missingLinesWithoutLoopsAndDuplications = SimplifyLines(missingLinesWithoutLoopsAndDuplications);

            return await MergeLines(missingLinesWithoutLoopsAndDuplications);
        }

        private List<LineString> SimplifyLines(IEnumerable<LineString> lineStings)
        {
            var lines = new List<LineString>();
            foreach (var lineSting in lineStings)
            {
                var simpleLine = DouglasPeuckerSimplifier.Simplify(lineSting, SIMPLIFICATION_TOLERANCE) as LineString;
                if (simpleLine == null)
                {
                    continue;
                }
                simpleLine = RadialDistanceByAngleSimplifier.Simplify(simpleLine, MINIMAL_MISSING_SELF_LOOP_PART_LENGTH, 90);
                if (simpleLine == null)
                {
                    continue;
                }
                lines.Add(simpleLine);
            }
            return lines;
        }

        private async Task<List<LineString>> FindMissingLines(List<LineString> gpxLines)
        {
            var missingLines = new List<LineString>();
            SplitLinesByNumberOfPoints(gpxLines);
            foreach (var gpxLine in gpxLines)
            {
                var lineStringsInArea = await GetLineStringsInArea(gpxLine);
                missingLines.AddRange(_gpxLoopsSplitterService.GetMissingLines(gpxLine, lineStringsInArea, MINIMAL_MISSING_PART_LENGTH, CLOSEST_POINT_TOLERANCE));
            }
            MergeBackLines(missingLines);
            return missingLines;
        }

        private void SplitLinesByNumberOfPoints(List<LineString> lineStings)
        {
            bool needToLinesToSplit;
            do
            {
                needToLinesToSplit = false;
                for (int lineIndex = 0; lineIndex < lineStings.Count; lineIndex++)
                {
                    var line = lineStings[lineIndex];
                    if (line.Count <= MAX_NUMBER_OF_POINTS_PER_LINE)
                    {
                        continue;
                    }
                    needToLinesToSplit = true;
                    var newLine = new LineString(line.Coordinates.Skip(line.Count / 2).ToArray());
                    if (lineIndex == lineStings.Count - 1)
                    {
                        lineStings.Add(newLine);
                    }
                    else
                    {
                        lineStings.Insert(lineIndex + 1, newLine);
                    }
                    lineStings[lineIndex] = new LineString(line.Coordinates.Take(line.Count / 2 + 1).ToArray());
                }
            } while (needToLinesToSplit);
        }

        private async Task<List<LineString>> GetLineStringsInArea(LineString gpxLine)
        {
            var northEast = _coordinatesConverter.ItmToWgs84(new NorthEast
            {
                North = (int)gpxLine.Coordinates.Max(c => c.Y),
                East = (int)gpxLine.Coordinates.Max(c => c.X)
            });
            var southWest = _coordinatesConverter.ItmToWgs84(new NorthEast
            {
                North = (int)gpxLine.Coordinates.Min(c => c.Y),
                East = (int)gpxLine.Coordinates.Min(c => c.X)
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

        private void MergeBackLines(List<LineString> missingLines)
        {
            for (int lineIndex = missingLines.Count - 1; lineIndex >= 1; lineIndex--)
            {
                var currentLineCoordinates = missingLines[lineIndex].Coordinates.ToList();
                var previousLineCoordinates = missingLines[lineIndex - 1].Coordinates;
                if (!currentLineCoordinates.First().Equals2D(previousLineCoordinates.Last()))
                {
                    continue;
                }
                currentLineCoordinates.RemoveAt(0);
                missingLines[lineIndex - 1] = new LineString(previousLineCoordinates.Concat(currentLineCoordinates).ToArray());
                missingLines.RemoveAt(lineIndex);
            }
        }

        private async Task<List<LineString>> MergeLines(List<LineString> lines)
        {
            if (lines.Any() == false)
            {
                return new List<LineString>();
            }
            var mergedLines = new List<LineString> { lines.First() };
            var linesToMerge = new List<LineString>(lines.Skip(1));
            while (linesToMerge.Any())
            {
                var foundAWayToMergeTo = false;
                for (var index = 0; index < linesToMerge.Count; index++)
                {
                    var lineToMerge = linesToMerge[index];
                    var lineToMergeTo = await FindALineToMergeTo(linesToMerge, mergedLines, lineToMerge);
                    if (lineToMergeTo == null)
                    {
                        continue;
                    }
                    var coordinates = lineToMerge.Coordinates;
                    if (lineToMerge.Coordinates.First().Distance(lineToMergeTo.Coordinates.First()) < CLOSEST_POINT_TOLERANCE * 2 ||
                        lineToMerge.Coordinates.Last().Distance(lineToMergeTo.Coordinates.Last()) < CLOSEST_POINT_TOLERANCE * 2)
                    {
                        coordinates = coordinates.Reverse().ToArray();
                    }
                    var mergedCoordinates = lineToMergeTo.Coordinates.ToList();
                    if (coordinates.Last().Distance(lineToMergeTo.Coordinates.First()) < CLOSEST_POINT_TOLERANCE * 2)
                    {
                        mergedCoordinates.InsertRange(0, coordinates);
                    }
                    else
                    {
                        mergedCoordinates.AddRange(coordinates);
                    }
                    linesToMerge.Remove(lineToMerge);
                    index--;
                    mergedLines[mergedLines.IndexOf(lineToMergeTo)] = new LineString(mergedCoordinates.ToArray());
                    foundAWayToMergeTo = true;
                }

                if (foundAWayToMergeTo)
                {
                    continue;
                }

                mergedLines.Add(linesToMerge.First());
                linesToMerge.RemoveAt(0);
            }
            return mergedLines;
        }

        private async Task<LineString> FindALineToMergeTo(List<LineString> linesToMerge, List<LineString> mergedLines, LineString lineToMerge)
        {
            foreach (var mergedLine in mergedLines)
            {
                var linesToTestAgainst = linesToMerge.Concat(mergedLines).Except(new[] { mergedLine, lineToMerge }).ToList();
                if (await CanBeMerged(mergedLine.Coordinates.Last(), lineToMerge.Coordinates.First(), linesToTestAgainst) ||
                    await CanBeMerged(mergedLine.Coordinates.First(), lineToMerge.Coordinates.Last(), linesToTestAgainst) ||
                    await CanBeMerged(mergedLine.Coordinates.First(), lineToMerge.Coordinates.First(), linesToTestAgainst) ||
                    await CanBeMerged(mergedLine.Coordinates.Last(), lineToMerge.Coordinates.Last(), linesToTestAgainst))
                {
                    return mergedLine;
                }
            }
            return null;
        }

        private async Task<bool> CanBeMerged(Coordinate coordinate1, Coordinate coordinate2, List<LineString> simplifiedLines)
        {
            var newLine = new LineString(new[] { coordinate1, coordinate2 });
            if (newLine.Length >= CLOSEST_POINT_TOLERANCE * 2)
            {
                return false;
            }
            var linesInArea = await GetLineStringsInArea(newLine);
            if (linesInArea.Concat(simplifiedLines).Any(l => l.Intersects(newLine)))
            {
                return false;
            }
            return true;
        }
    }
}
