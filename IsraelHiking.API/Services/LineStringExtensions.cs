using NetTopologySuite.Geometries;

namespace IsraelHiking.API.Services
{
    internal static class LineStringExtensions
    {
        public static string GetOsmId(this LineString lineString)
        {
            return lineString.UserData.ToString();
        }

        public static void SetOsmId(this LineString lineString, string id)
        {
            lineString.UserData = id;
        }
    }
}
