using IsraelHiking.API.Gpx;
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
        /// Convetrs <see cref="GpxFile"/> to <see cref="FeatureCollection"/>
        /// </summary>
        /// <param name="gpx">The GPX data to convert</param>
        /// <returns>The GeoJson data</returns>
        FeatureCollection ToGeoJson(GpxFile gpx);
        /// <summary>
        /// Converts <see cref="FeatureCollection"/> to <see cref="GpxFile"/>
        /// </summary>
        /// <param name="collection">The GeoJson data to convert</param>
        /// <returns>The GPX data </returns>
        GpxFile ToGpx(FeatureCollection collection);
    }
}