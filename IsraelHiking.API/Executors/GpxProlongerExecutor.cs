using System.Collections.Generic;
using System.Linq;
using GeoAPI.Geometries;
using NetTopologySuite.Geometries;

namespace IsraelHiking.API.Executors
{

    /// <inheritdoc/>
    public class GpxProlongerExecutor : IGpxProlongerExecutor
    {
        /// <inheritdoc/>
        public LineString ProlongLineStart(LineString lineToProlong, Coordinate[] originalCoordinates, IReadOnlyList<LineString> existingLineStrings, double minimalDistance, double maximalLength)
        {
            var coordinateToAdd = ProlongLine(lineToProlong.Coordinates.First(), originalCoordinates.Reverse().ToArray(), lineToProlong, existingLineStrings, minimalDistance, maximalLength);
            if (coordinateToAdd != null)
            {
                return new LineString(new[] { coordinateToAdd }.Concat(lineToProlong.Coordinates).ToArray());
            }
            return lineToProlong;
        }

        /// <inheritdoc/>
        public LineString ProlongLineEnd(LineString lineToProlong, Coordinate[] originalCoordinates, IReadOnlyList<LineString> existingLineStrings, double minimalDistance, double maximalLength)
        {
            var coordinateToAdd = ProlongLine(lineToProlong.Coordinates.Last(), originalCoordinates, lineToProlong, existingLineStrings, minimalDistance, maximalLength);
            if (coordinateToAdd != null)
            {
                return new LineString(lineToProlong.Coordinates.Concat(new[] { coordinateToAdd }).ToArray());
            }
            return lineToProlong;
        }

        private Coordinate ProlongLine(Coordinate startCoordinate, Coordinate[] originalCoordinates, LineString lineToProlong, IReadOnlyList<LineString> existingLineStrings, double minimalDistance, double maximalLength)
        {
            Coordinate prolongCoordinate = startCoordinate;
            var point = new Point(startCoordinate);
            var originalLineIndex = 0;
            if (!existingLineStrings.Any())
            {
                return null;
            }
            var closestLine = existingLineStrings.OrderBy(l => point.Distance(l)).First();
            while (closestLine.Distance(point) >= minimalDistance)
            {
                if (originalLineIndex >= originalCoordinates.Length)
                {
                    return null;
                }
                if (prolongCoordinate.Distance(startCoordinate) > maximalLength)
                {
                    return null;
                }
                prolongCoordinate = originalCoordinates[originalLineIndex];
                originalLineIndex++;
                point = new Point(prolongCoordinate);
                closestLine = existingLineStrings.OrderBy(l => point.Distance(l)).First();
            }

            Coordinate coordinateToAdd;
            if (closestLine.Coordinates.Last().Distance(point.Coordinate) < minimalDistance * 1.5)
            {
                coordinateToAdd = closestLine.Coordinates.Last();
            }
            else if (closestLine.Coordinates.First().Distance(point.Coordinate) < minimalDistance * 1.5)
            {
                coordinateToAdd = closestLine.Coordinates.First();
            }
            else
            {
                var lineToAdd = new LineString(new[] { startCoordinate, point.Coordinate });
                coordinateToAdd = lineToAdd.Buffer(minimalDistance).Intersection(closestLine).Coordinate;
            }
            var connectionLine = new LineString(new[] { startCoordinate, coordinateToAdd });
            if (connectionLine.Crosses(lineToProlong) || existingLineStrings.Any(l => l.Crosses(connectionLine)))
            {
                return null;
            }
            return coordinateToAdd;
        }
    }
}
