using System.Linq;
using NetTopologySuite.Features;
using NetTopologySuite.Geometries;

namespace IsraelHiking.Common.Extensions
{
    public static class GeoJsonExtensions
    {
        /// <summary>
        /// This is an extention method to attribute table to get the wikipedia page title by language
        /// </summary>
        /// <param name="attributes">The attributes table</param>
        /// <param name="language">The required language</param>
        /// <returns>The page title, empty if none exist</returns>
        public static string GetWikipediaTitle(this IAttributesTable attributes, string language)
        {
            if (!attributes.GetNames().Any(n => n.StartsWith(FeatureAttributes.WIKIPEDIA)))
            {
                return string.Empty;
            }
            var wikiWithLanguage = FeatureAttributes.WIKIPEDIA + ":" + language;
            if (attributes.Exists(wikiWithLanguage))
            {
                return attributes[wikiWithLanguage].ToString();
            }
            if (!attributes.Exists(FeatureAttributes.WIKIPEDIA))
            {
                return string.Empty;
            }
            var titleWithLanguage = attributes[FeatureAttributes.WIKIPEDIA].ToString();
            var languagePrefix = language + ":";
            if (titleWithLanguage.StartsWith(languagePrefix))
            {
                return titleWithLanguage.Substring(languagePrefix.Length);
            }
            return string.Empty;
        }

        public static bool Has(this IAttributesTable table, string key, string value)
        {
            return table.Exists(key) &&
                   table[key]?.ToString() == value;
        }

        public static bool IsValidContainer(this IFeature feature)
        {
            if (feature.Geometry is Point)
            {
                return false;
            }
            if (feature.Geometry is LineString)
            {
                return false;
            }
            if (feature.Geometry is MultiLineString)
            {
                return false;
            }
            if (feature.Geometry is MultiPoint)
            {
                return false;
            }
            var isFeatureADecentCity = feature.Attributes.Has("boundary", "administrative") &&
                                       feature.Attributes.Exists("admin_level") &&
                                       int.TryParse(feature.Attributes["admin_level"].ToString(), out int adminLevel) &&
                                       adminLevel <= 8;
            if (isFeatureADecentCity)
            {
                return true;
            }
            if (feature.Attributes.Exists("place") && 
                !feature.Attributes.Has("place", "suburb") &&
                !feature.Attributes.Has("place", "neighbourhood") &&
                !feature.Attributes.Has("place", "quarter") &&
                !feature.Attributes.Has("place", "city_block") &&
                !feature.Attributes.Has("place", "borough")
                )
            {
                return true;
            }
            if (feature.Attributes.Has("landuse", "forest"))
            {
                return true;
            }
            return feature.Attributes.Has("leisure", "nature_reserve") ||
                   feature.Attributes.Has("boundary", "national_park") ||
                   feature.Attributes.Has("boundary", "protected_area");
        }
    }
}
