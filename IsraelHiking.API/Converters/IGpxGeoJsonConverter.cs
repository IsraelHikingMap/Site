using GeoJSON.Net.Feature;
using IsraelHiking.API.Gpx.GpxTypes;

namespace IsraelHiking.API.Converters
{
    public interface IGpxGeoJsonConverter
    {
        FeatureCollection ToGeoJson(gpxType gpx);
        gpxType ToGpx(FeatureCollection collection);
    }
}