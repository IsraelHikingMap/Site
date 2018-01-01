using System.Collections.Generic;
using System.Linq;
using GeoAPI.Geometries;
using NetTopologySuite.Geometries;
using NetTopologySuite.LinearReferencing;
using NetTopologySuite.Operation.Distance;

namespace IsraelHiking.API.Executors
{
    internal class LineAndCoordinate {
        public ILineString Line { get; set; }
        public Coordinate Coordinate { get; set; }
    }

    /// <summary>
    /// This is the required input for the prolong algorithm
    /// </summary>
    public class GpxProlongerExecutorInput
    {
        /// <summary>
        /// The lines that needs to be prolonged - non-readonly lines
        /// </summary>
        public List<ILineString> LinesToProlong { get; set; }

        /// <summary>
        /// The original coordinates that start from the line's end
        /// </summary>
        public Coordinate[] OriginalCoordinates { get; set; }
        /// <summary>
        /// Existing lines in the area in ITM coordinates
        /// </summary>
        public IReadOnlyList<ILineString> ExistingItmHighways { get; set; }
        /// <summary>
        /// The minimal distance to another line in order to stop prolonging
        /// </summary>
        public double MinimalDistance { get; set; }
        /// <summary>
        /// The minimal area that is considered to be a valid area to allow prolonging a line
        /// </summary>
        public double MinimalAreaSize { get; set; }
    }

    /// <inheritdoc/>
    public class GpxProlongerExecutor : IGpxProlongerExecutor
    {
        private readonly IGeometryFactory _geometryFactory;

        /// <summary>
        /// Constructor
        /// </summary>
        /// <param name="geometryFactory"></param>
        public GpxProlongerExecutor(IGeometryFactory geometryFactory)
        {
            _geometryFactory = geometryFactory;
        }

        /// <inheritdoc/>
        public List<ILineString> Prolong(GpxProlongerExecutorInput input)
        {
            // going from end to start.
            var endTostart = input.OriginalCoordinates.Reverse().ToList();
            var linesToProlong = input.LinesToProlong.Select(l => l.Reverse() as ILineString).Reverse().ToList();
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
                if (next.Line == current.Line && linesToProlong.Contains(current.Line))
                {
                    HandleSelfClosingCase(input, current, next, linesToProlong);
                }
                else if (current.Line.Intersects(next.Line) || current.Line.Distance(next.Line) < 0.1)
                {
                    HandleIntersectionCase(input, current, next, linesToProlong);
                }
                else
                {
                    HandleTwoLinesCase(input, current, next, linesToProlong);
                }
                allLines = input.ExistingItmHighways.Concat(linesToProlong).ToList();
                endTostart = endTostart.Skip(endTostart.IndexOf(next.Coordinate) + 1).ToList();
                current.Coordinate = next.Coordinate;
                current.Line = next.Line;
            }
            return linesToProlong.Select(l => l.Reverse() as ILineString).Reverse().ToList();
        }

        private void HandleSelfClosingCase(GpxProlongerExecutorInput input, LineAndCoordinate current, LineAndCoordinate next, List<ILineString> linesToProlong)
        {
            var lengthIndexedLine = new LengthIndexedLine(current.Line);
            var closestCoordinateCurrentIndex = lengthIndexedLine.Project(current.Coordinate);
            var closestCoordinateNextIndex = lengthIndexedLine.Project(next.Coordinate);
            var segment = lengthIndexedLine.ExtractLine(closestCoordinateCurrentIndex, closestCoordinateNextIndex);
            var coordinates = segment.Coordinates.Concat(new[] { segment.Coordinates.First() }).ToArray();
            if (coordinates.Length < 4)
            {
                return;
            }
            var polygon = new Polygon(new LinearRing(coordinates));
            if (polygon.Area < input.MinimalAreaSize)
            {
                return;
            }
            var currentCoordinate = lengthIndexedLine.ExtractPoint(closestCoordinateCurrentIndex);
            var nextCoordinate = lengthIndexedLine.ExtractPoint(closestCoordinateNextIndex);
            if (!AddCoordinate(current.Line, currentCoordinate, nextCoordinate, linesToProlong, input.MinimalDistance))
            {
                linesToProlong.Add(_geometryFactory.CreateLineString(new[] { currentCoordinate, nextCoordinate }));
            }
        }

        private void HandleIntersectionCase(GpxProlongerExecutorInput input, LineAndCoordinate current, LineAndCoordinate next, List<ILineString> linesToProlong)
        {
            var intersection = current.Line.Intersection(next.Line).Coordinates
                .OrderBy(c => c.Distance(current.Coordinate) + c.Distance(next.Coordinate)).FirstOrDefault();

            if (intersection == null)
            {
                var distance = new DistanceOp(current.Line, next.Line);
                intersection = distance.NearestPoints().First();
            }

            var currentLengthIndexedLine = new LengthIndexedLine(current.Line);
            var closestCoordinateCurrentIndex = currentLengthIndexedLine.Project(current.Coordinate);
            var closestCoordinateCurrentIntersectionIndex = currentLengthIndexedLine.Project(intersection);
            var currentSegment =
                currentLengthIndexedLine.ExtractLine(closestCoordinateCurrentIndex, closestCoordinateCurrentIntersectionIndex);

            var nextLengthIndexedLine = new LengthIndexedLine(next.Line);
            var closestCoordinateNextIndex = nextLengthIndexedLine.Project(next.Coordinate);
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
            linesToProlong.Add(_geometryFactory.CreateLineString(new[] {currentCoordinate, nextCoordinate}));
        }

        private void HandleTwoLinesCase(GpxProlongerExecutorInput input, LineAndCoordinate current, LineAndCoordinate next, List<ILineString> linesToProlong)
        {
            var currentLengthIndexedLine = new LengthIndexedLine(current.Line);
            var currentCoordinate = currentLengthIndexedLine.ExtractPoint(currentLengthIndexedLine.Project(current.Coordinate));
            var nextLengthIndexedLine = new LengthIndexedLine(next.Line);
            var nextCoordinate = nextLengthIndexedLine.ExtractPoint(nextLengthIndexedLine.Project(next.Coordinate));

            var bothLinesAreInList = linesToProlong.Contains(current.Line) && linesToProlong.Contains(next.Line);
            if (bothLinesAreInList && current.Line.Coordinates.Last().Distance(current.Coordinate) < input.MinimalDistance &&
                next.Line.Coordinates.First().Distance(next.Coordinate) < input.MinimalDistance)
            {
                linesToProlong.Remove(current.Line);
                linesToProlong.Remove(next.Line);
                linesToProlong.Add(_geometryFactory.CreateLineString(current.Line.Coordinates
                    .Concat(next.Line.Coordinates).ToArray()));
            }
            else if (bothLinesAreInList &&
                     current.Line.Coordinates.First().Distance(current.Coordinate) < input.MinimalDistance &&
                     next.Line.Coordinates.Last().Distance(next.Coordinate) < input.MinimalDistance)
            {
                linesToProlong.Remove(current.Line);
                linesToProlong.Remove(next.Line);
                linesToProlong.Add(_geometryFactory.CreateLineString(next.Line.Coordinates
                    .Concat(current.Line.Coordinates).ToArray()));
            }
            else if (!AddCoordinate(current.Line, currentCoordinate, nextCoordinate, linesToProlong, input.MinimalDistance))
            {
                if (!AddCoordinate(next.Line, currentCoordinate, nextCoordinate, linesToProlong, input.MinimalDistance))
                {
                    linesToProlong.Add(_geometryFactory.CreateLineString(new[] { currentCoordinate, nextCoordinate }));
                }
            }
        }

        private LineAndCoordinate GetClosest(List<Coordinate> endTostart, List<ILineString> allLines, GpxProlongerExecutorInput input)
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

        private bool AddCoordinate(ILineString currentLine, Coordinate currentCoordinate, Coordinate nextCoordinate, List<ILineString> linesToProlong, double minimalDistance)
        {
            if (linesToProlong.Contains(currentLine) == false)
            {
                return false;
            }
            if (currentLine.Coordinates.Last().Distance(currentCoordinate) < minimalDistance)
            {
                linesToProlong.Remove(currentLine);
                linesToProlong.Add(_geometryFactory.CreateLineString(currentLine.Coordinates.Concat(new[] { nextCoordinate }).ToArray()));
                return true;
            }
            if (currentLine.Coordinates.Last().Distance(nextCoordinate) < minimalDistance)
            {
                linesToProlong.Remove(currentLine);
                linesToProlong.Add(_geometryFactory.CreateLineString(currentLine.Coordinates.Concat(new[] { currentCoordinate }).ToArray()));
                return true;
            }
            if (currentLine.Coordinates.First().Distance(currentCoordinate) < minimalDistance)
            {
                linesToProlong.Remove(currentLine);
                linesToProlong.Add(_geometryFactory.CreateLineString(new[] { nextCoordinate }.Concat(currentLine.Coordinates).ToArray()));
                return true;
            }
            if (currentLine.Coordinates.First().Distance(nextCoordinate) < minimalDistance)
            {
                linesToProlong.Remove(currentLine);
                linesToProlong.Add(_geometryFactory.CreateLineString(new[] { currentCoordinate }.Concat(currentLine.Coordinates).ToArray()));
                return true;
            }
            return false;
        }
    }
}
