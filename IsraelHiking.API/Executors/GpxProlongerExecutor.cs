using System.Collections.Generic;
using System.Linq;
using GeoAPI.Geometries;
using NetTopologySuite.Geometries;
using NetTopologySuite.LinearReferencing;

namespace IsraelHiking.API.Executors
{

    /// <inheritdoc/>
    public class GpxProlongerExecutor : IGpxProlongerExecutor
    {
        /// <inheritdoc/>
        public LineString ProlongLineStart(LineString lineToProlong, Coordinate[] originalCoordinates, IReadOnlyList<LineString> existingItmHighways, double minimalDistance, double maximalLength)
        {
            var coordinateToAdd = ProlongLine(lineToProlong.Coordinates.First(), originalCoordinates.Reverse().ToArray(), lineToProlong, existingItmHighways, minimalDistance, maximalLength);
            if (coordinateToAdd != null)
            {
                return new LineString(new[] { coordinateToAdd }.Concat(lineToProlong.Coordinates).ToArray());
            }
            return lineToProlong;
        }

        /// <inheritdoc/>
        public LineString ProlongLineEnd(LineString lineToProlong, Coordinate[] originalCoordinates, IReadOnlyList<LineString> existingItmHighways, double minimalDistance, double maximalLength)
        {
            var coordinateToAdd = ProlongLine(lineToProlong.Coordinates.Last(), originalCoordinates, lineToProlong, existingItmHighways, minimalDistance, maximalLength);
            if (coordinateToAdd != null)
            {
                return new LineString(lineToProlong.Coordinates.Concat(new[] { coordinateToAdd }).ToArray());
            }
            return lineToProlong;
        }

        private Coordinate ProlongLine(Coordinate startCoordinate, Coordinate[] originalCoordinates, LineString lineToProlong, IReadOnlyList<LineString> existingItmHighways, double minimalDistance, double maximalLength)
        {
            var prolongCoordinate = startCoordinate;
            var lineToTestAgainst = new LineString(new [] {startCoordinate, prolongCoordinate});
            var originalLineIndex = 0;
            if (!existingItmHighways.Any())
            {
                return null;
            }
            var closestLine = existingItmHighways.OrderBy(l => lineToTestAgainst.Distance(l)).First();
            while (closestLine.Distance(lineToTestAgainst) >= minimalDistance)
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
                lineToTestAgainst = new LineString(new[] { startCoordinate, prolongCoordinate });
                closestLine = existingItmHighways.OrderBy(l => lineToTestAgainst.Distance(l)).First();
            }

            var coordinateToAdd = GetCoordinateToAdd(lineToTestAgainst, closestLine, minimalDistance);
            var connectionLine = new LineString(new[] { startCoordinate, coordinateToAdd });
            if (connectionLine.Crosses(lineToProlong))
            {
                return null;
            }
            var crossedLines = existingItmHighways.Where(l => l.Crosses(connectionLine)).ToArray();
            if (crossedLines.Any() == false)
            {
                return coordinateToAdd;
            }
            foreach (var crossedLine in crossedLines)
            {
                coordinateToAdd = GetCoordinateToAdd(lineToTestAgainst, crossedLine, minimalDistance);
                connectionLine = new LineString(new[] { startCoordinate, coordinateToAdd });
                if (crossedLines.Any(l => l.Crosses(connectionLine)) == false)
                {
                    return coordinateToAdd;
                }
            }
            return null;
        }

        private static Coordinate GetCoordinateToAdd(LineString lineToTestAgainst, LineString closestLine, double minimalDistance)
        {
            Coordinate coordinateToAdd;
            var closestCoordinate = lineToTestAgainst.Coordinates.Last();
            if (closestLine.Coordinates.Last().Distance(closestCoordinate) < minimalDistance*1.5)
            {
                coordinateToAdd = closestLine.Coordinates.Last();
            }
            else if (closestLine.Coordinates.First().Distance(closestCoordinate) < minimalDistance*1.5)
            {
                coordinateToAdd = closestLine.Coordinates.First();
            }
            else
            {
                var closestCoordinateOnExitingLine = closestLine.Coordinates.OrderBy(c => c.Distance(closestCoordinate)).First();
                if (closestCoordinateOnExitingLine.Distance(closestCoordinate) < minimalDistance)
                {
                    coordinateToAdd = closestCoordinateOnExitingLine;
                }
                else
                {
                    var line = new LengthIndexedLine(closestLine);
                    var projectedIndex = line.Project(closestCoordinate);
                    coordinateToAdd = line.ExtractPoint(projectedIndex);
                }
            }
            return coordinateToAdd;
        }
    }
}
