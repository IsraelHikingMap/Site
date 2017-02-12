using System.Collections.Generic;
using System.Linq;
using GeoAPI.Geometries;
using NetTopologySuite.Geometries;

namespace IsraelHiking.API.Executors
{
    /// <inheritdoc/>
    public class GpxLoopsSplitterExecutor : IGpxLoopsSplitterExecutor
    {
        /// <inheritdoc/>
        public List<LineString> GetMissingLines(LineString gpxLine, IReadOnlyList<LineString> existingLineStrings, double minimalMissingPartLength, double closestPointTolerance)
        {
            if (gpxLine.Coordinates.Length <= 1)
            {
                return new List<LineString>();
            }
            var gpxSplit = new List<LineString>();
            var waypointsGroup = new List<Coordinate>();
            
            foreach (var coordinate in gpxLine.Coordinates)
            {
                if (IsCloseToALine(coordinate, existingLineStrings, closestPointTolerance))
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
            var reversedGpxLine = ReverseLine(gpxLine);

            int coordinateIndex = 0;
            while (coordinateIndex < reversedGpxLine.Coordinates.Length)
            {
                var indexOfClosingLine = GetClosingLoopIndex(reversedGpxLine, coordinateIndex, closestPointTolerance);
                if (indexOfClosingLine == -1)
                {
                    coordinateIndex++;
                    continue;
                }
                AddLineString(lines, reversedGpxLine.Coordinates.Take(indexOfClosingLine).ToArray());
                reversedGpxLine = new LineString(reversedGpxLine.Coordinates.Skip(indexOfClosingLine).ToArray());
                coordinateIndex = 0;
            }
            AddLineString(lines, reversedGpxLine.Coordinates);

            lines = lines.Select(ReverseLine).ToList();
            lines.Reverse();
            return lines;
        }

        private int GetClosingLoopIndex(LineString gpxLine, int currentIndex, double closestPointTolerance)
        {
            int indexOfLinePrefix = currentIndex - 1;
            var currentCoordinatePoint = new Point(gpxLine[currentIndex]);
            while (indexOfLinePrefix >= 0)
            {
                var prefixPoint = new Point(gpxLine.Coordinates[indexOfLinePrefix]);
                if (currentCoordinatePoint.Distance(prefixPoint) > closestPointTolerance)
                {
                    break;
                }
                indexOfLinePrefix--;
            }
            if (indexOfLinePrefix < 0)
            {
                return -1;
            }
            var distance = indexOfLinePrefix > 0
                    ? currentCoordinatePoint.Distance(new LineString(gpxLine.Coordinates.Take(indexOfLinePrefix + 1).ToArray()))
                    : currentCoordinatePoint.Distance(new Point(gpxLine.Coordinates[indexOfLinePrefix]));
            return distance < closestPointTolerance ? indexOfLinePrefix + 1 : -1;
        }

        private void AddLineString(ICollection<LineString> gpxSplit, Coordinate[] coordinates)
        {
            //if (coordinates.Length == 2 & data.Start == true && data.End == true)
            //{
            //    // when line is split near the end?
            //    return;
            //}
            if (coordinates.Length < 3) //2
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

        private LineString ReverseLine(LineString lineString)
        {
            return (LineString)lineString.Reverse();
        }
    }
}