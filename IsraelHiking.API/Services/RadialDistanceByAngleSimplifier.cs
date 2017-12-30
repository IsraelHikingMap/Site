using System;
using System.Collections.Generic;
using System.Linq;
using GeoAPI.Geometries;
using NetTopologySuite.Algorithm;
using NetTopologySuite.Geometries;

namespace IsraelHiking.API.Services
{
    /// <summary>
    /// This class simplifies a line string by removing points that create a sharp turn within a radius from previous point.
    /// This class follows the NTS simplifier pattern
    /// </summary>
    public class RadialDistanceByAngleSimplifier
    {
        private readonly IGeometry _geometry;
        /// <summary>
        /// The radial distance tolerance - the lower it is the less simplified the line will be
        /// </summary>
        public double DistanceTolerance { get; set; }
        /// <summary>
        /// The angle tolerance - the lower the number will be the less simplified the line will be
        /// </summary>
        public double AngleTolerance { get; set; }

        /// <summary>
        /// This simplifies a line by getting the radial distance tolerance and angle distance tolerance
        /// </summary>
        /// <param name="geometry">The geometry to simplify</param>
        /// <param name="distanceTolerance">The radial distance tolerance</param>
        /// <param name="angleTolerace">The angle tolerance in degrees</param>
        /// <returns>A simlified <see cref="LineString"/></returns>
        public static LineString Simplify(IGeometry geometry, double distanceTolerance, double angleTolerace)
        {
            var simplifier = new RadialDistanceByAngleSimplifier(geometry)
            {
                DistanceTolerance = distanceTolerance,
                AngleTolerance = angleTolerace
            };
            return simplifier.GetResultGeometry();
        }

        /// <summary>
        /// Constructor
        /// </summary>
        /// <param name="geometry">The geometry to simplify</param>
        public RadialDistanceByAngleSimplifier(IGeometry geometry)
        {
            _geometry = geometry;
        }

        /// <summary>
        /// Simplifies the geometry, allways keeps the first and last points
        /// </summary>
        /// <returns>A simplified <see cref="LineString"/></returns>
        public LineString GetResultGeometry()
        {
            var coordinates = _geometry.Coordinates;
            if (coordinates.Length <= 1)
            {
                return null;
            }
            if (coordinates.Length == 2)
            {
                return new LineString(coordinates);
            }
            var simplified = new List<Coordinate> { coordinates.First(), coordinates.Skip(1).First() };
            for (int coordinateIndex = 2; coordinateIndex < coordinates.Length - 1; coordinateIndex++)
            {
                var coordinate = coordinates[coordinateIndex];
                if (SimplifyByAngle(coordinateIndex, coordinates, simplified))
                {
                    continue;
                }

                if (coordinate.Distance(simplified.Last()) > DistanceTolerance)
                {
                    simplified.Add(coordinate);
                }
            }
            simplified.Add(coordinates.Last());
            return new LineString(simplified.ToArray());
        }

        /// <summary>
        /// Will add another point to the simplified list if the angle is within tolerance.
        /// In case it's not within tolrance it will check if the next point's angle is also not within tolerance 
        /// and in this case it will remove the previous point from the simplified list.
        /// This will ensure that angles within the simplified list will not violate the angle tolrance.
        /// In case the distance between two points is large enough the angle tolerance violation is allowed.
        /// </summary>
        /// <param name="coordinateIndex">Current coordinate index</param>
        /// <param name="coordinates">The original coordinates</param>
        /// <param name="simplified">The simplified coordinates</param>
        /// <returns>True if the simplified list was changed</returns>
        private bool SimplifyByAngle(int coordinateIndex, Coordinate[] coordinates, List<Coordinate> simplified)
        {
            var coordinate = coordinates[coordinateIndex];
            var angleDifference = GetAngleDifference(simplified[simplified.Count - 2], simplified.Last(), coordinate);
            if (IsAngleWithinTolerance(angleDifference))
            {
                simplified.Add(coordinate);
                return true;
            }
            // sharp angle
            if (coordinateIndex + 1 < coordinates.Length && 
                (coordinate.Distance(simplified.Last()) < DistanceTolerance ||
                simplified.Last().Distance(simplified[simplified.Count - 2]) < DistanceTolerance))
            {
                angleDifference = GetAngleDifference(simplified[simplified.Count - 2], simplified.Last(), coordinates[coordinateIndex + 1]);
                if (IsAngleWithinTolerance(angleDifference))
                {
                    return false;
                }
                simplified.Remove(simplified.Last());
                simplified.Add(coordinate);
                return true;
            }
            return false;
        }

        private double GetAngleDifference(Coordinate coordinate1, Coordinate coordinate2, Coordinate coordinate3)
        {
            var angle1 = AngleUtility.ToDegrees(AngleUtility.Angle(coordinate1, coordinate2));
            var angle2 = AngleUtility.ToDegrees(AngleUtility.Angle(coordinate2, coordinate3));
            return Math.Abs(angle2 - angle1);
        }

        private bool IsAngleWithinTolerance(double angle)
        {
            return (angle < 180 - AngleTolerance) || (angle > 180 + AngleTolerance);
        }
    }
}
