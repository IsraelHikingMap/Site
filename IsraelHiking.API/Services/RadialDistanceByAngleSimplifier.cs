using System;
using System.Collections.Generic;
using System.Linq;
using GeoAPI.Geometries;
using NetTopologySuite.Geometries;
using OsmSharp.Math.Algorithms;

namespace IsraelHiking.API.Services
{
    /// <summary>
    /// This class simplifies a line string by removing points that create a sharp turn within a radius from previous point.
    /// </summary>
    public class RadialDistanceByAngleSimplifier
    {
        private readonly IGeometry _geometry;
        public double DistanceTolerance { get; set; }
        public double AngleTolerance { get; set; }

        public static LineString Simplify(IGeometry geometry, double distanceTolerance, double angleTolerace)
        {
            var simplifier = new RadialDistanceByAngleSimplifier(geometry)
            {
                DistanceTolerance = distanceTolerance,
                AngleTolerance = angleTolerace
            };
            return simplifier.GetResultGeometry();
        }

        public RadialDistanceByAngleSimplifier(IGeometry geometry)
        {
            _geometry = geometry;
        }

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
                    var angle1 = GetAngle(simplified[simplified.Count - 2], simplified.Last());
                    var angle2 = GetAngle(simplified.Last(), coordinate);
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

        private double GetAngle(Coordinate coordinate1, Coordinate coordinate2)
        {
            // Can't use LineString's angle due to bug in NTS: https://github.com/NetTopologySuite/NetTopologySuite/issues/136		
            var xDiff = coordinate2.X - coordinate1.X;
            if (xDiff == 0)
            {
                return 90;
            }
            var yDiff = coordinate2.Y - coordinate1.Y;
            var angle = Math.Atan(yDiff / xDiff) * 180 / Math.PI;
            if (xDiff < 0)
            {
                angle += 180;
            }
            if (angle < 0)
            {
                angle += 360;
            }
            return angle;
        }
    }
}
