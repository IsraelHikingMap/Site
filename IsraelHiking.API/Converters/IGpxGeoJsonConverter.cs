using NetTopologySuite.Features;
using NetTopologySuite.IO;

namespace IsraelHiking.API.Converters
{
    /// <summary>
    /// Converts between GPX and GeoJson format
    /// </summary>
    public interface IGpxGeoJsonConverter
    {
        /// <summary>
        /// Convetrs <see cref="gpxType"/> to <see cref="FeatureCollection"/>
        /// </summary>
        /// <param name="gpx">The GPX data to convert</param>
        /// <returns>The GeoJson data</returns>
        FeatureCollection ToGeoJson(gpxType gpx);
        /// <summary>
        /// Converts <see cref="FeatureCollection"/> to <see cref="gpxType"/>
        /// </summary>
        /// <param name="collection">The GeoJson data to convert</param>
        /// <returns>The GPX data </returns>
        gpxType ToGpx(FeatureCollection collection);
    }
}