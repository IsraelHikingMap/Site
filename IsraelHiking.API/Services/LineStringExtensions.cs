using NetTopologySuite.Geometries;

namespace IsraelHiking.API.Services;

internal static class LineStringExtensions
{
    public static long GetOsmId(this LineString lineString)
    {
        return (long)lineString.UserData;
    }

    public static void SetOsmId(this LineString lineString, long id)
    {
        lineString.UserData = id;
    }
}