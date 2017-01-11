using System.Collections.Generic;
using System.Linq;
using GeoAPI.Geometries;
using NetTopologySuite.Geometries;

namespace IsraelHiking.API.Services
{
    /// <inheritdoc/>
    public class GpxLoopsSplitterService : IGpxLoopsSplitterService
    {
        /// <inheritdoc/>
        public List<LineString> GetMissingLines(LineString gpxLine, IReadOnlyList<LineString> existingLineStrings, double minimalMissingPartLength, double closestPointTolerance)
        {
            var gpxSplit = new List<LineString>();
            var waypointsGroup = new List<Coordinate>();
            foreach (var coordinate in gpxLine.Coordinates)
            {
                if (waypointsGroup.Count > 0 && waypointsGroup.Last().Equals(coordinate))
                {
                    continue;
                }
                if (IsCloseToALine(coordinate, existingLineStrings.Concat(gpxSplit).ToArray(), closestPointTolerance))
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

        /// <inheritdoc/>
        public List<LineString> SplitSelfLoops(LineString gpxLine, double closestPointTolerance)
        {
            var lines = new List<LineString>();
            gpxLine = (LineString)gpxLine.Reverse();

            int coordinateIndex = 0;
            while (coordinateIndex < gpxLine.Coordinates.Length)
            {
                if (IsClosingALoop(gpxLine, coordinateIndex, closestPointTolerance) == false)
                {
                    coordinateIndex++;
                    continue;
                }
                AddLineString(lines, gpxLine.Coordinates.Take(coordinateIndex).ToArray());
                gpxLine = new LineString(gpxLine.Coordinates.Skip(coordinateIndex).ToArray());
                coordinateIndex = 0;
            }
            AddLineString(lines, gpxLine.Coordinates);

            lines = lines.Select(l => (LineString)l.Reverse()).ToList();
            lines.Reverse();
            return lines;
        }

        private bool IsClosingALoop(LineString gpxLine, int currentIndex, double closestPointTolerance)
        {
            int indexOfLinePrefix = currentIndex - 1;
            var currentCoordinatePoint = new Point(gpxLine[currentIndex]);
            while (indexOfLinePrefix >= 0)
            {
                if (currentCoordinatePoint.Distance(new Point(gpxLine.Coordinates[indexOfLinePrefix])) >
                    closestPointTolerance)
                {
                    break;
                }
                indexOfLinePrefix--;
            }
            if (indexOfLinePrefix < 0)
            {
                return false;
            }
            var distance = indexOfLinePrefix > 0
                    ? currentCoordinatePoint.Distance(new LineString(gpxLine.Coordinates.Take(indexOfLinePrefix + 1).ToArray()))
                    : currentCoordinatePoint.Distance(new Point(gpxLine.Coordinates[indexOfLinePrefix]));
            return distance < closestPointTolerance;
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

        private bool IsCloseToALine(Coordinate coordinate, IReadOnlyList<LineString> lineStrings, double closestPointTolerance)
        {
            var point = new Point(coordinate);
            if (!lineStrings.Any())
            {
                return false;
            }
            return lineStrings.Min(l => l.Distance(point)) < closestPointTolerance;
        }
    }
}