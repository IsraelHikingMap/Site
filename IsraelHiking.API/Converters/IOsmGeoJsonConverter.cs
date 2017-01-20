using NetTopologySuite.Features;
using OsmSharp.Osm;

namespace IsraelHiking.API.Converters
{
    /// <summary>
    /// Converts from OSM to GeoJson
    /// </summary>
    public interface IOsmGeoJsonConverter
    {
        /// <summary>
        /// Converts from <see cref="ICompleteOsmGeo"/> to <see cref="Feature"/>
        /// </summary>
        /// <param name="completeOsmGeo">The OSM element to convert</param>
        /// <returns>The GeoJson data</returns>
        Feature ToGeoJson(ICompleteOsmGeo completeOsmGeo);
    }
}