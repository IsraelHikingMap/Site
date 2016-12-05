using System.Collections.Generic;
using System.Linq;
using GeoAPI.Geometries;
using NetTopologySuite.Geometries;

namespace IsraelHiking.API.Services
{
    public class GpxSplitterService : IGpxSplitterService
    {
        private const double CLOSEST_POINT_TOLERANCE = 30; // meters

        /// <summary>
        /// This part of this splitter will remove line that already exsits and will split lines that are close to an exsiting line.
        /// This can be used with both OSM lines and other parts of the same GPS trace.
        /// The algorithm is faily simple - go over all the points in the given <see cref="gpxLine"/> and look for point that are close to <see cref="existingLineStrings"/>
        /// </summary>
        /// <param name="gpxLine">The line to manipulate</param>
        /// <param name="existingLineStrings">The lines to test agains</param>
        /// <param name="minimalMissingPartLength">The minimal length allowed to a trace that can be added</param>
        /// <returns>a split line from the orignal line</returns>
        public List<LineString> GetMissingLines(LineString gpxLine, IReadOnlyList<LineString> existingLineStrings, double minimalMissingPartLength)
        {
            var gpxSplit = new List<LineString>();
            var waypointsGroup = new List<Coordinate>();
            foreach (var coordinate in gpxLine.Coordinates)
            {
                if (waypointsGroup.Count > 0 && waypointsGroup.Last().Equals(coordinate))
                {
                    continue;
                }
                if (IsCloseToALine(coordinate, existingLineStrings.Concat(gpxSplit).ToArray()))
                {
                    waypointsGroup.Add(coordinate);
                    AddLineString(gpxSplit, waypointsGroup.ToArray());
                    waypointsGroup = new List<Coordinate> { coordinate };
                    continue;
                }
                waypointsGroup.Add(coordinate);
            }
            AddLineString(gpxSplit, waypointsGroup.ToArray());
            return gpxSplit.Where(l => l.Length > minimalMissingPartLength).ToList();
        }

        /// <summary>
        /// This part of the splitter if responsible for splitting a line with a self loop.
        /// It will allway return lines that do not have self loop, but can be duplicate of one another
        /// Use <see cref="GetMissingLines"/> method to remove those duplications.
        /// </summary>
        /// <param name="gpxLine">The line to look for self loops in</param>
        /// <returns>a list of lines that do not have self loops</returns>
        public List<LineString> SplitSelfLoops(LineString gpxLine)
        {
            var lines = new List<LineString>();
            gpxLine = (LineString)gpxLine.Reverse();
            for (int coordinateIndex = 0; coordinateIndex < gpxLine.Coordinates.Length; coordinateIndex++)
            {
                var indices = GetAllIndexesWithinTolerance(gpxLine, coordinateIndex);
                var linesSplit = SliptLineByIndeices(gpxLine, indices);
                gpxLine = linesSplit.First();
                foreach (var lineString in linesSplit.Skip(1))
                {
                    AddLineString(lines, lineString.Coordinates);
                }
            }
            AddLineString(lines, gpxLine.Coordinates);
            lines = lines.Select(l => (LineString)l.Reverse()).ToList();
            return lines;
        }

        private List<LineString> SliptLineByIndeices(LineString gpxLine, List<int> indices)
        {
            var lines = new List<LineString>();
            var startingPointIndex = 0;
            for (int i = 1; i < indices.Count; i++)
            {
                var index = indices[i];
                var previousIndex = indices[i - 1];
                if (index - previousIndex == 1)
                {
                    continue;
                }
                AddLineString(lines, gpxLine.Coordinates.Skip(startingPointIndex).Take(index - startingPointIndex).ToArray());
                startingPointIndex = index;
            }
            AddLineString(lines, gpxLine.Coordinates.Skip(startingPointIndex).ToArray());
            return lines;
        }

        private List<int> GetAllIndexesWithinTolerance(LineString gpxLine, int coordinateIndex)
        {
            var list = new List<int> { coordinateIndex };
            for (int nextCoordinateIndex = coordinateIndex + 1;
                nextCoordinateIndex < gpxLine.Count;
                nextCoordinateIndex++)
            {
                var nextCoordinate = gpxLine.Coordinates[nextCoordinateIndex];
                var nextCoordinatePoint = new Point(nextCoordinate);
                var distance = coordinateIndex > 0
                    ? nextCoordinatePoint.Distance(new LineString(gpxLine.Coordinates.Take(coordinateIndex + 1).ToArray()))
                    : nextCoordinatePoint.Distance(new Point(gpxLine.Coordinates[coordinateIndex]));
                if (distance < CLOSEST_POINT_TOLERANCE)
                {
                    list.Add(nextCoordinateIndex);
                }
            }
            return list;
        }

        private void AddLineString(ICollection<LineString> gpxSplit, Coordinate[] coordinates)
        {
            if (coordinates.Length < 3)
            {
                return;
            }
            var lineString = new LineString(coordinates);
            gpxSplit.Add(lineString);
        }

        private bool IsCloseToALine(Coordinate coordinate, IReadOnlyList<LineString> lineStrings)
        {
            var point = new Point(coordinate);
            if (!lineStrings.Any())
            {
                return false;
            }
            return lineStrings.Min(l => l.Distance(point)) < CLOSEST_POINT_TOLERANCE;
        }
    }
}