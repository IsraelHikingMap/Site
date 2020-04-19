using NetTopologySuite.Geometries;
using NetTopologySuite.LinearReferencing;
using NetTopologySuite.Operation.Distance;
using System.Collections.Generic;
using System.Linq;

namespace IsraelHiking.API.Executors
{
    internal class LineAndCoordinate {
        public LineString Line { get; set; }
        public Coordinate Coordinate { get; set; }
    }

    internal class SegmentWithLines
    {
        public Coordinate[] OriginalCoordinates { get; set; }
        public LineAndCoordinate Start { get; set; }
        public Coordinate StartProjected { get; set; }
        public LineAndCoordinate End { get; set; }
        public Coordinate EndProjected { get; set; }
    }

    /// <summary>
    /// This is the required input for the prolong algorithm
    /// </summary>
    public class GpxProlongerExecutorInput
    {
        /// <summary>
        /// The lines that needs to be prolonged - non-readonly lines
        /// </summary>
        public List<LineString> LinesToProlong { get; set; }

        /// <summary>
        /// The original coordinates that start from the line's end
        /// </summary>
        public Coordinate[] OriginalCoordinates { get; set; }
        /// <summary>
        /// Existing lines in the area in ITM coordinates
        /// </summary>
        public IReadOnlyList<LineString> ExistingItmHighways { get; set; }
        /// <summary>
        /// The minimal distance to another line in order to stop prolonging
        /// </summary>
        public double MinimalDistance { get; set; }
        /// <summary>
        /// The minimal area that is considered to be a valid area to allow prolonging a line
        /// </summary>
        public double MinimalAreaSize { get; set; }

        /// <summary>
        /// The minimal line length in meters that is considered a valid line
        /// </summary>
        public double MinimalLength { get; set; }
    }

    /// <inheritdoc/>
    public class GpxProlongerExecutor : IGpxProlongerExecutor
    {
        private readonly GeometryFactory _geometryFactory;

        /// <summary>
        /// Constructor
        /// </summary>
        /// <param name="geometryFactory"></param>
        public GpxProlongerExecutor(GeometryFactory geometryFactory)
        {
            _geometryFactory = geometryFactory;
        }

        /// <inheritdoc/>
        public List<LineString> Prolong(GpxProlongerExecutorInput input)
        {
            // going from end to start.
            var endTostart = input.OriginalCoordinates.Reverse().ToList();
            var linesToProlong = input.LinesToProlong.Select(l => l.Reverse() as LineString).Reverse().ToList();
            var allLines = input.ExistingItmHighways.Concat(linesToProlong).ToList();
            var current = GetClosest(endTostart, allLines, input);
            if (current == null)
            {
                return input.LinesToProlong;
            }
            endTostart = endTostart.Skip(endTostart.IndexOf(current.Coordinate) + 1).ToList();
            while (endTostart.Any())
            {
                var next = GetClosest(endTostart, allLines, input);
                if (next == null)
                {
                    break;
                }
                var endIndex = endTostart.IndexOf(next.Coordinate);
                var originalBridgingSegment = new [] { current.Coordinate}.Concat(endTostart.Take(endIndex + 1)).ToArray();
                var segmentWithLines = CreateSegmentWithLines(originalBridgingSegment, current, next);
                if (next.Line == current.Line && linesToProlong.Contains(current.Line))
                {
                    HandleSelfClosingCase(input, segmentWithLines, linesToProlong);
                }
                else if (current.Line.Intersects(next.Line) || current.Line.Distance(next.Line) < 0.1)
                {
                    HandleIntersectionCase(input, segmentWithLines, linesToProlong);
                }
                else
                {
                    HandleTwoLinesCase(input, segmentWithLines, linesToProlong);
                }
                allLines = input.ExistingItmHighways.Concat(linesToProlong).ToList();
                endTostart = endTostart.Skip(endTostart.IndexOf(next.Coordinate) + 1).ToList();
                current.Coordinate = next.Coordinate;
                current.Line = next.Line;
            }
            return linesToProlong.Select(l => l.Reverse() as LineString).Where(l => l.Length > input.MinimalLength).Reverse().ToList();
        }

        private void HandleSelfClosingCase(GpxProlongerExecutorInput input, SegmentWithLines segment, List<LineString> linesToProlong)
        {
            var lengthIndexedLine = new LengthIndexedLine(segment.Start.Line);
            var closestCoordinateCurrentIndex = lengthIndexedLine.Project(segment.Start.Coordinate);
            var closestCoordinateNextIndex = lengthIndexedLine.Project(segment.End.Coordinate);
            var indexedSegment = lengthIndexedLine.ExtractLine(closestCoordinateCurrentIndex, closestCoordinateNextIndex);
            var coordinates = indexedSegment.Coordinates.Concat(new[] { indexedSegment.Coordinates.First() }).ToArray();
            if (coordinates.Length < 4)
            {
                return;
            }
            var polygon = new Polygon(new LinearRing(coordinates));
            if (polygon.Area < input.MinimalAreaSize)
            {
                return;
            }
            if (!AddSegmentToLine(segment.Start.Line, segment, linesToProlong, input.MinimalDistance))
            {
                linesToProlong.Add(CreateLineString(segment.StartProjected, segment.OriginalCoordinates, segment.EndProjected));
            }
        }

        private void HandleIntersectionCase(GpxProlongerExecutorInput input, SegmentWithLines segment, List<LineString> linesToProlong)
        {
            var intersection = segment.Start.Line.Intersection(segment.End.Line).Coordinates
                .OrderBy(c => c.Distance(segment.Start.Coordinate) + c.Distance(segment.End.Coordinate)).FirstOrDefault();

            if (intersection == null)
            {
                var distance = new DistanceOp(segment.Start.Line, segment.End.Line);
                intersection = distance.NearestPoints().First();
            }

            var currentLengthIndexedLine = new LengthIndexedLine(segment.Start.Line);
            var closestCoordinateCurrentIndex = currentLengthIndexedLine.Project(segment.Start.Coordinate);
            var closestCoordinateCurrentIntersectionIndex = currentLengthIndexedLine.Project(intersection);
            var currentSegment =
                currentLengthIndexedLine.ExtractLine(closestCoordinateCurrentIndex, closestCoordinateCurrentIntersectionIndex);

            var nextLengthIndexedLine = new LengthIndexedLine(segment.End.Line);
            var closestCoordinateNextIndex = nextLengthIndexedLine.Project(segment.End.Coordinate);
            var closestCoordinateNextIntersectionIndex = nextLengthIndexedLine.Project(intersection);
            var nextSegment =
                nextLengthIndexedLine.ExtractLine(closestCoordinateNextIntersectionIndex, closestCoordinateNextIndex);

            var coordinates = currentSegment.Coordinates.Concat(nextSegment.Coordinates)
                .Concat(new[] {currentSegment.Coordinates.First()}).ToArray();
            if (coordinates.Length < 4)
            {
                return;
            }
            var polygon = new Polygon(new LinearRing(coordinates));
            if (polygon.Area < input.MinimalAreaSize)
            {
                return;
            }
            var currentCoordinate = currentLengthIndexedLine.ExtractPoint(closestCoordinateCurrentIndex);
            var nextCoordinate = nextLengthIndexedLine.ExtractPoint(closestCoordinateNextIndex);
            var line = CreateLineString(currentCoordinate, segment.OriginalCoordinates, nextCoordinate);
            linesToProlong.Add(line);
        }

        private void HandleTwoLinesCase(GpxProlongerExecutorInput input, SegmentWithLines segment, List<LineString> linesToProlong)
        {
            var bothLinesAreInList = linesToProlong.Contains(segment.Start.Line) && linesToProlong.Contains(segment.End.Line);
            if (bothLinesAreInList && 
                segment.Start.Line.Coordinates.Last().Distance(segment.Start.Coordinate) < input.MinimalDistance &&
                segment.End.Line.Coordinates.First().Distance(segment.End.Coordinate) < input.MinimalDistance)
            {
                linesToProlong.Remove(segment.Start.Line);
                linesToProlong.Remove(segment.End.Line);
                linesToProlong.Add(_geometryFactory.CreateLineString(
                    segment.Start.Line.Coordinates
                        .Concat(segment.OriginalCoordinates)
                        .Concat(segment.End.Line.Coordinates)
                        .Distinct()
                        .ToArray()));
            }
            else if (!AddSegmentToLine(segment.Start.Line, segment, linesToProlong, input.MinimalDistance))
            {
                if (!AddSegmentToLine(segment.End.Line, segment, linesToProlong, input.MinimalDistance))
                {
                    linesToProlong.Add(CreateLineString(segment.StartProjected, segment.OriginalCoordinates, segment.EndProjected));
                }
            }
        }

        /// <summary>
        /// Get the closest line and the coordinate that is close to that line on the original list.
        /// </summary>
        /// <param name="endTostart"></param>
        /// <param name="allLines"></param>
        /// <param name="input"></param>
        /// <returns></returns>
        private LineAndCoordinate GetClosest(List<Coordinate> endTostart, List<LineString> allLines, GpxProlongerExecutorInput input)
        {
            foreach (var coordinate in endTostart)
            {
                var point = new Point(coordinate);
                var lineString = allLines.FirstOrDefault(l => l.Distance(point) < input.MinimalDistance);
                if (lineString == null)
                {
                    continue;
                }
                return new LineAndCoordinate
                {
                    Coordinate = coordinate,
                    Line = lineString
                };
            }
            return null;
        }

        private bool AddSegmentToLine(LineString line, SegmentWithLines segment, List<LineString> linesToProlong, double minimalDistance)
        {
            if (linesToProlong.Contains(line) == false)
            {
                return false;
            }
            if (line.Coordinates.Last().Distance(segment.StartProjected) < minimalDistance)
            {
                linesToProlong.Remove(line);
                var concatLine = CreateLineString(null,
                    line.Coordinates.Concat(segment.OriginalCoordinates).ToArray(), 
                    segment.EndProjected);
                linesToProlong.Add(concatLine);
                return true;
            }
            if (line.Coordinates.First().Distance(segment.EndProjected) < minimalDistance)
            {
                linesToProlong.Remove(line);
                var concatLine = CreateLineString(segment.StartProjected,
                    segment.OriginalCoordinates.Concat(line.Coordinates).ToArray(), null);
                linesToProlong.Add(concatLine);
                return true;
            }
            return false;
        }

        private LineString CreateLineString(Coordinate currentCoordinate, Coordinate[] originalCoordinates, Coordinate nextCoordinate)
        {
            var list = originalCoordinates.ToList();
            if (currentCoordinate != null)
            {
                list.Insert(0, currentCoordinate);
            }
            if (nextCoordinate != null)
            {
                list.Add(nextCoordinate);
            }
            return _geometryFactory.CreateLineString(list.ToArray());
        }

        private SegmentWithLines CreateSegmentWithLines(Coordinate[] segment, LineAndCoordinate current, LineAndCoordinate next)
        {
            var currentLengthIndexedLine = new LengthIndexedLine(current.Line);
            var currentCoordinate = currentLengthIndexedLine.ExtractPoint(currentLengthIndexedLine.Project(current.Coordinate));
            var nextLengthIndexedLine = new LengthIndexedLine(next.Line);
            var nextCoordinate = nextLengthIndexedLine.ExtractPoint(nextLengthIndexedLine.Project(next.Coordinate));

            var segmentWithLines = new SegmentWithLines
            {
                OriginalCoordinates = segment,
                Start = current,
                StartProjected = currentCoordinate,
                End = next,
                EndProjected = nextCoordinate
            };
            return segmentWithLines;
        }
    }
}
