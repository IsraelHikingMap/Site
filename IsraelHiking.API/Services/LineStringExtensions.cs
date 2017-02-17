using GeoAPI.Geometries;

namespace IsraelHiking.API.Services
{
    internal static class LineStringExtensions
    {
        public static string GetOsmId(this ILineString lineString)
        {
            return lineString.UserData.ToString();
        }

        public static void SetOsmId(this ILineString lineString, string id)
        {
            lineString.UserData = id;
        }
    }
}
