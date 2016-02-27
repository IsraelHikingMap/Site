using GeoJSON.Net.Feature;
using IsraelHiking.Gpx;

namespace IsraelHiking.API.Gpx
{
    public interface IGpxGeoJsonConverter
    {
        FeatureCollection ToGeoJson(gpxType gpx);
        gpxType ToGpx(FeatureCollection collection);
    }
}