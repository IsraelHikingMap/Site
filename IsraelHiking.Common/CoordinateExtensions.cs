using NetTopologySuite.Geometries;
using System.Linq;

namespace IsraelHiking.Common
{
    public static class CoordinateExtensions
    {
        public static Coordinate FromLatLng(this Coordinate coordinate, string latLng)
        {
            var split = latLng.Split(',');
            return split.Length != 2 ? null : new Coordinate(double.Parse(split.Last()), double.Parse(split.First()));
        }

        public static Coordinate FromLatLng(this Coordinate coordinate, LatLng latLng)
        {
            return new CoordinateZ(latLng.Lng, latLng.Lat);
        }

        public static double[] ToDoubleArray(this Coordinate coordinate)
        {
            return new [] { coordinate.X, coordinate.Y };
        }

        public static Coordinate FromDoubleArray(this Coordinate coordinate, double[] point)
        {
            return new Coordinate(point[0], point[1]);
        }
    }
}
