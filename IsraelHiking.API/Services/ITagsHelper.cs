using System.Collections.Generic;
using IsraelHiking.Common;
using NetTopologySuite.Features;

namespace IsraelHiking.API.Services;

/// <summary>
/// This class facilitates for search factor and icon for geojson features used for search
/// </summary>
public interface ITagsHelper
{
    /// <summary>
    /// Find relevant tags for an icon
    /// </summary>
    /// <param name="icon">The icon</param>
    /// <returns>A list of relevant tags combinations</returns>
    List<List<KeyValuePair<string, string>>> FindTagsForIcon(string icon);
    /// <summary>
    /// Returns all the icons grouped by their category for a specific categories' type
    /// </summary>
    /// <returns></returns>
    IEnumerable<Category> GetCategoriesByGroup(string categoriesType);

    /// <summary>
    /// Returns the icon color category for the given tags
    /// </summary>
    /// <param name="attributes">An attributes table with OSM tags</param>
    /// <returns></returns>
    IconColorCategory GetIconColorCategoryForTags(IAttributesTable attributes);
}