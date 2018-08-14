using IsraelHiking.API.Gpx;
using NetTopologySuite.Features;

namespace IsraelHiking.API.Converters
{
    /// <summary>
    /// Converts between GPX and GeoJson format
    /// </summary>
    public interface IGpxGeoJsonConverter
    {
        /// <summary>
        /// Convetrs <see cref="GpxMainObject"/> to <see cref="FeatureCollection"/>
        /// </summary>
        /// <param name="gpx">The GPX data to convert</param>
        /// <returns>The GeoJson data</returns>
        FeatureCollection ToGeoJson(GpxMainObject gpx);
        /// <summary>
        /// Converts <see cref="FeatureCollection"/> to <see cref="GpxMainObject"/>
        /// </summary>
        /// <param name="collection">The GeoJson data to convert</param>
        /// <returns>The GPX data </returns>
        GpxMainObject ToGpx(FeatureCollection collection);
    }
}