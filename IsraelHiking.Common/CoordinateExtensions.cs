using System.Linq;
using GeoAPI.Geometries;

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
            return new Coordinate(latLng.Lng, latLng.Lat);
        }
    }
}
