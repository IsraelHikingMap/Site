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
        /// Simplifies the geometry
        /// </summary>
        /// <returns>A simplified <see cref="LineString"/></returns>
        public LineString GetResultGeometry()
        {
            var coordinates = _geometry.Coordinates;
            if (coordinates.Length == 0)
            {
                return null;
            }
            var simplified = new List<Coordinate> {coordinates.First()};
            for (int coordinateIndex = 1; coordinateIndex < coordinates.Length; coordinateIndex++)
            {
                var coordinate = coordinates[coordinateIndex];
                if (simplified.Count > 1)
                {
                    var angle1 = AngleUtility.ToDegrees(AngleUtility.Angle(simplified[simplified.Count - 2], simplified.Last()));
                    var angle2 = AngleUtility.ToDegrees(AngleUtility.Angle(simplified.Last(), coordinate));
                    var angleDifference = Math.Abs(angle2 - angle1);
                    if ((angleDifference < 180 - AngleTolerance) || (angleDifference > 180 + AngleTolerance))
                    {
                        simplified.Add(coordinate);
                        continue;
                    }
                }
                
                if (coordinate.Distance(simplified.Last()) > DistanceTolerance)
                {
                    simplified.Add(coordinate);
                }
            }
            return simplified.Count <= 1 ? null : new LineString(simplified.ToArray());
        }
    }
}
