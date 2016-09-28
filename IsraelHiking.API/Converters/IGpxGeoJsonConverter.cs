using IsraelHiking.API.Gpx.GpxTypes;
using NetTopologySuite.Features;

namespace IsraelHiking.API.Converters
{
    public interface IGpxGeoJsonConverter
    {
        FeatureCollection ToGeoJson(gpxType gpx);
        gpxType ToGpx(FeatureCollection collection);
    }
}