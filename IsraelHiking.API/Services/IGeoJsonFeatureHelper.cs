using NetTopologySuite.Features;

namespace IsraelHiking.API.Services
{
    /// <summary>
    /// This class facilatates for search factor and icon for geojson features used for search
    /// </summary>
    public interface IGeoJsonFeatureHelper
    {
        /// <summary>
        /// Get's the relevant icon for a <see cref="Feature"/>
        /// </summary>
        /// <param name="feature">The <see cref="Feature"/></param>
        /// <returns>A link to an image that holds the icon, empty if not found</returns>
        string GetIcon(Feature feature);

        /// <summary>
        /// Returns the search factor for a <see cref="Feature"/>
        /// </summary>
        /// <param name="feature">The <see cref="Feature"/></param>
        /// <returns>A search factor, null if not found</returns>
        double? GetSearchFactor(Feature feature);

        /// <summary>
        /// Returns the POI type for a <see cref="Feature"/>
        /// </summary>
        /// <param name="feature">The <see cref="Feature"/></param>
        /// <returns>A POI type string</returns>
        string GetPoiType(Feature feature);
    }
}