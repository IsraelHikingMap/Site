using NetTopologySuite.Features;
using OsmSharp.Complete;

namespace IsraelHiking.API.Converters;

/// <summary>
/// Converts from OSM data objects to geojson and back
/// </summary>
public interface IOsmGeoJsonConverter
{
    /// <summary>
    /// Converts from <see cref="ICompleteOsmGeo"/> to <see cref="Feature"/>
    /// </summary>
    /// <param name="completeOsmGeo">The OSM element to convert</param>
    /// <returns>The GeoJson data</returns>
    IFeature ToGeoJson(ICompleteOsmGeo completeOsmGeo);
}