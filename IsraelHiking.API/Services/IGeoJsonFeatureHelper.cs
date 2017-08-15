using NetTopologySuite.Features;

namespace IsraelHiking.API.Services
{
    /// <summary>
    /// This class facilatates for search factor and icon for geojson features used for search
    /// </summary>
    public interface IGeoJsonFeatureHelper
    {
        /// <summary>
        /// Returns the relevant icon for a <see cref="Feature"/>
        /// </summary>
        /// <param name="feature">The <see cref="Feature"/></param>
        /// <returns>a string of the icon to use icon-*, empty if not found</returns>
        string GetIcon(Feature feature);

        /// <summary>
        /// Returns the relevant icon's color for a <see cref="Feature"/>
        /// </summary>
        /// <param name="feature">The <see cref="Feature"/></param>
        /// <returns>The icon's color - black by default</returns>
        string GetIconColor(Feature feature);

        /// <summary>
        /// Returns the search factor for a <see cref="Feature"/>
        /// </summary>
        /// <param name="feature">The <see cref="Feature"/></param>
        /// <returns>A search factor, null if not found</returns>
        double GetSearchFactor(Feature feature);

        /// <summary>
        /// Returns the POI type for a <see cref="Feature"/>
        /// </summary>
        /// <param name="feature">The <see cref="Feature"/></param>
        /// <returns>A POI type string</returns>
        string GetPoiCategory(Feature feature);
    }
}