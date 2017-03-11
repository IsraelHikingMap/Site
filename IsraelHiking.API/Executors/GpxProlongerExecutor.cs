using System.Collections.Generic;
using System.Linq;
using GeoAPI.Geometries;
using NetTopologySuite.LinearReferencing;

namespace IsraelHiking.API.Executors
{

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
        public ILineString ProlongLineStart(ILineString lineToProlong, Coordinate[] originalCoordinates, IReadOnlyList<ILineString> existingItmHighways, double minimalDistance, double maximalLength)
        {
            var coordinateToAdd = ProlongLine(lineToProlong.Coordinates.First(), originalCoordinates.Reverse().ToArray(), lineToProlong, existingItmHighways, minimalDistance, maximalLength);
            if (coordinateToAdd != null)
            {
                return _geometryFactory.CreateLineString(new[] { coordinateToAdd }.Concat(lineToProlong.Coordinates).ToArray());
            }
            return lineToProlong;
        }

        /// <inheritdoc/>
        public ILineString ProlongLineEnd(ILineString lineToProlong, Coordinate[] originalCoordinates, IReadOnlyList<ILineString> existingItmHighways, double minimalDistance, double maximalLength)
        {
            var coordinateToAdd = ProlongLine(lineToProlong.Coordinates.Last(), originalCoordinates, lineToProlong, existingItmHighways, minimalDistance, maximalLength);
            if (coordinateToAdd != null)
            {
                return _geometryFactory.CreateLineString(lineToProlong.Coordinates.Concat(new[] { coordinateToAdd }).ToArray());
            }
            return lineToProlong;
        }

        private Coordinate ProlongLine(Coordinate startCoordinate, Coordinate[] originalCoordinates, ILineString lineToProlong, IReadOnlyList<ILineString> existingItmHighways, double minimalDistance, double maximalLength)
        {
            var prolongCoordinate = startCoordinate;
            var lineToTestAgainst = _geometryFactory.CreateLineString(new [] {startCoordinate, prolongCoordinate});
            var originalCoordinateIndex = 0;
            if (!existingItmHighways.Any())
            {
                return null;
            }
            var closestLine = existingItmHighways.OrderBy(l => lineToTestAgainst.Distance(l)).First();
            while (closestLine.Distance(lineToTestAgainst) >= minimalDistance)
            {
                if (originalCoordinateIndex >= originalCoordinates.Length)
                {
                    return null;
                }
                if (prolongCoordinate.Distance(startCoordinate) > maximalLength)
                {
                    return null;
                }
                prolongCoordinate = originalCoordinates[originalCoordinateIndex];
                originalCoordinateIndex++;
                lineToTestAgainst = _geometryFactory.CreateLineString(new[] { startCoordinate, prolongCoordinate });
                closestLine = existingItmHighways.OrderBy(l => lineToTestAgainst.Distance(l)).First();
            }

            var coordinateToAdd = GetCoordinateToAdd(lineToTestAgainst, closestLine, minimalDistance);
            var connectionLine = _geometryFactory.CreateLineString(new[] { startCoordinate, coordinateToAdd });
            if (connectionLine.Crosses(lineToProlong))
            {
                return null;
            }
            // HM TODO: fix issue with cross' false positive.
            //if (closestLine.Crosses(connectionLine))
            //{
            //    connectionLine = new LineString(new[] { startCoordinate, closestLine.Intersection(connectionLine).Coordinate });
            //}
            var crossedLines = existingItmHighways.Where(l => l.Crosses(connectionLine)).ToArray();
            if (crossedLines.Any(l => l != closestLine) == false)
            {
                return coordinateToAdd;
            }
            foreach (var crossedLine in crossedLines)
            {
                coordinateToAdd = GetCoordinateToAdd(lineToTestAgainst, crossedLine, minimalDistance);
                connectionLine = _geometryFactory.CreateLineString(new[] { startCoordinate, coordinateToAdd });
                if (crossedLines.Any(l => l != crossedLine && l.Crosses(connectionLine)) == false)
                {
                    return coordinateToAdd;
                }
            }
            return null;
        }

        /// <summary>
        /// This methods tries to find the coordinate to add on the closest line and prefers to return one of the edges if possible.
        /// </summary>
        /// <param name="lineToTestAgainst"></param>
        /// <param name="closestLine"></param>
        /// <param name="minimalDistance"></param>
        /// <returns></returns>
        private Coordinate GetCoordinateToAdd(ILineString lineToTestAgainst, ILineString closestLine, double minimalDistance)
        {
            var closestCoordinate = lineToTestAgainst.Coordinates.Last();
            var edgeCoordinate = GetEdgeCoordiante(closestLine, closestCoordinate, minimalDistance, 1.5);
            if (edgeCoordinate != null)
            {
                return edgeCoordinate;
            }
            if (lineToTestAgainst.Intersects(closestLine))
            {
                var intecsectionCoordinate = lineToTestAgainst.Intersection(closestLine).Coordinates.First();
                edgeCoordinate = GetEdgeCoordiante(closestLine, intecsectionCoordinate, minimalDistance, 3);
                return edgeCoordinate ?? intecsectionCoordinate;
            }
            var closestCoordinateOnExitingLine = closestLine.Coordinates.OrderBy(c => c.Distance(closestCoordinate)).First();
            if (closestCoordinateOnExitingLine.Distance(closestCoordinate) < minimalDistance)
            {
                return closestCoordinateOnExitingLine;
            }
            
            var closestLineIndexed = new LengthIndexedLine(closestLine);
            var closestCoordinateProjectedIndex = closestLineIndexed.Project(closestCoordinate);
            var projectedCoordinate = closestLineIndexed.ExtractPoint(closestCoordinateProjectedIndex);
            _geometryFactory.PrecisionModel.MakePrecise(projectedCoordinate);
            edgeCoordinate = GetEdgeCoordiante(closestLine, projectedCoordinate, minimalDistance, 3);
            return edgeCoordinate ?? projectedCoordinate;
        }

        private Coordinate GetEdgeCoordiante(ILineString closestLine, Coordinate closestCoordinate, double minimalDistance, double distanceFactor)
        {
            var edgeCoordinates = new[] {closestLine.Coordinates.First(), closestLine.Coordinates.Last()};
            return edgeCoordinates.OrderBy(c => c.Distance(closestCoordinate))
                    .FirstOrDefault(c => c.Distance(closestCoordinate) < minimalDistance*distanceFactor);
        }
    }
}
