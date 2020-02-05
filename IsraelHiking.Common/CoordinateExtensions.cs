using NetTopologySuite.Geometries;
using System.Linq;

namespace IsraelHiking.Common
{
    public static class CoordinateExtensions
    {
        public static Coordinate ToCoordinate(this string latLng)
        {
            var split = latLng.Split(',');
            return split.Length != 2 ? null : new Coordinate(double.Parse(split.Last()), double.Parse(split.First()));
        }

        public static Coordinate ToCoordinate(this LatLng latLng)
        {
            return new CoordinateZ(latLng.Lng, latLng.Lat, double.NaN);
        }

        public static double[] ToDoubleArray(this Coordinate coordinate)
        {
            return new [] { coordinate.X, coordinate.Y };
        }

        public static Coordinate ToCoordinate(this double[] point)
        {
            return new Coordinate(point[0], point[1]);
        }
    }
}
