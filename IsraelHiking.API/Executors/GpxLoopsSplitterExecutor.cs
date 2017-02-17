using System.Collections.Generic;
using System.Linq;
using GeoAPI.Geometries;
using NetTopologySuite.Geometries;

namespace IsraelHiking.API.Executors
{
    /// <inheritdoc/>
    public class GpxLoopsSplitterExecutor : IGpxLoopsSplitterExecutor
    {
        private readonly IGeometryFactory _geometryFactory;

        /// <summary>
        /// Constructor
        /// </summary>
        /// <param name="geometryFactory"></param>
        public GpxLoopsSplitterExecutor(IGeometryFactory geometryFactory)
        {
            _geometryFactory = geometryFactory;
        }

        /// <inheritdoc/>
        public List<ILineString> GetMissingLines(ILineString gpxLine, IReadOnlyList<ILineString> existingLineStrings, double minimalMissingPartLength, double closestPointTolerance)
        {
            if (gpxLine.Coordinates.Length <= 1)
            {
                return new List<ILineString>();
            }
            var gpxSplit = new List<ILineString>();
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
        public List<ILineString> SplitSelfLoops(ILineString gpxLine, double closestPointTolerance)
        {
            var lines = new List<ILineString>();
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
                var reminingPoints = reversedGpxLine.Coordinates.Skip(indexOfClosingLine).ToArray();
                reversedGpxLine = reminingPoints.Length > 1 ? _geometryFactory.CreateLineString(reminingPoints) : _geometryFactory.CreateLineString(new Coordinate[0]);
                coordinateIndex = 0;
            }
            AddLineString(lines, reversedGpxLine.Coordinates);

            lines = lines.Select(ReverseLine).ToList();
            lines.Reverse();
            return lines;
        }

        private int GetClosingLoopIndex(ILineString gpxLine, int currentIndex, double closestPointTolerance)
        {
            int indexOfLinePrefix = currentIndex - 1;
            var currentCoordinatePoint = new Point(gpxLine.Coordinates[currentIndex]);
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

        private void AddLineString(ICollection<ILineString> gpxSplit, Coordinate[] coordinates)
        {

            if (coordinates.Length < 3)
            {
                return;
            }
            var lineString = _geometryFactory.CreateLineString(coordinates);
            gpxSplit.Add(lineString);
        }

        private bool IsCloseToALine(Coordinate coordinate, IReadOnlyList<ILineString> lineStrings, double closestPointTolerance)
        {
            var point = new Point(coordinate);
            if (!lineStrings.Any())
            {
                return false;
            }
            return lineStrings.Min(l => l.Distance(point)) < closestPointTolerance;
        }

        private ILineString ReverseLine(ILineString lineString)
        {
            return (ILineString)lineString.Reverse();
        }
    }
}