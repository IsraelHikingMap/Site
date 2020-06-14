using NetTopologySuite.Features;
using NetTopologySuite.Geometries;
using OsmSharp;
using System;
using System.Collections.Generic;
using System.Linq;

namespace IsraelHiking.Common.Extensions
{
    public static class GeoJsonExtensions
    {
        public static void AddOrUpdate(this IAttributesTable attributes, string key, object value)
        {
            if (!attributes.Exists(key))
            {
                attributes.Add(key, value);
            }
            else
            {
                attributes[key] = value;
            }
        }

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

        /// <summary>
        /// Get an attribute by language, this is relevant to OSM attributes convetion
        /// </summary>
        /// <param name="attributes">The attributes table</param>
        /// <param name="key">The attribute name</param>
        /// <param name="language">The user interface language</param>
        /// <returns></returns>
        public static string GetByLanguage(this IAttributesTable attributes, string key, string language)
        {
            if (attributes.Exists(key + ":" + language))
            {
                return attributes[key + ":" + language].ToString();
            }
            if (attributes.Exists(key))
            {
                return attributes[key].ToString();
            }
            return string.Empty;
        }

        public static bool IsValidContainer(this IFeature feature)
        {
            if (!(feature.Geometry is Polygon) && !(feature.Geometry is MultiPolygon))
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

        /// <summary>
        /// This function will search the feature attributes for all relevant names and place them in an object 
        /// to allow database search and a single place to look for a feature names.
        /// </summary>
        /// <param name="feature"></param>
        public static void SetTitles(this IFeature feature)
        {
            var table = new AttributesTable();
            var names = feature.Attributes.GetNames().OrderBy(n => n.Length).Where(a => a.Contains(FeatureAttributes.NAME)).ToArray();
            foreach (var language in Languages.Array)
            {
                var namesByLanguage = names.Where(n => n.Contains(":" + language)).Select(a => feature.Attributes[a].ToString()).ToArray();
                names = names.Except(names.Where(n => n.Contains(":" + language))).ToArray();
                table.Add(language, namesByLanguage);
            }
            // names with no specific language
            table.Add(Languages.ALL, names.Select(n => feature.Attributes[n].ToString()).ToArray());
            feature.Attributes.AddOrUpdate(FeatureAttributes.POI_NAMES, table);
        }

        public static void SetId(this IFeature feature)
        {
            feature.Attributes.AddOrUpdate(FeatureAttributes.POI_ID, GetId(feature.Attributes[FeatureAttributes.POI_SOURCE].ToString(), feature.Attributes[FeatureAttributes.ID].ToString()));
        }

        public static string GetId(this IFeature feature)
        {
            return feature.Attributes[FeatureAttributes.POI_ID].ToString();
        }

        public static string GetId(string source, string id)
        {
            return source + "_" + id;
        }

        public static string GetTitle(this IFeature feature, string language)
        {
            if (!(feature.Attributes[FeatureAttributes.POI_NAMES] is AttributesTable titleByLanguage))
            {
                return string.Empty;
            }
            if (!titleByLanguage.Exists(language))
            {
                language = Languages.ALL;
            }
            var title = GetStringListFromAttributeValue(titleByLanguage[language]).FirstOrDefault();
            if (string.IsNullOrWhiteSpace(title) && language != Languages.ALL)
            {
                title = GetStringListFromAttributeValue(titleByLanguage[Languages.ALL]).FirstOrDefault();
            }
            return title ?? string.Empty;

        }

        public static string[] GetTitles(this IFeature feature)
        {
            if (!(feature.Attributes[FeatureAttributes.POI_NAMES] is AttributesTable titleByLanguage))
            {
                return new string[0];
            }
            
            return titleByLanguage.GetValues().Select(GetStringListFromAttributeValue).SelectMany(v => v).Distinct().ToArray();
        }

        public static List<string> GetStringListFromAttributeValue(object value)
        {
            var titles = new List<string>();
            switch (value)
            {
                case List<object> objectsList:
                    titles.AddRange(objectsList.Select(o => o.ToString()).ToList());
                    break;
                case List<string> stringsList:
                    titles.AddRange(stringsList);
                    break;
                case string[] array:
                    titles.AddRange(array);
                    break;
                case string str:
                    titles.Add(str);
                    break;
            }
            return titles;
        }

        /// <summary>
        /// This function checks if a feature is a valid point of interest:
        /// Either has a name, description, image or related points of interest.
        /// </summary>
        /// <param name="feature"></param>
        /// <param name="language"></param>
        /// <returns></returns>
        public static bool IsProperPoi(this IFeature feature, string language)
        {
            return feature.Attributes.GetByLanguage(FeatureAttributes.NAME, language) != string.Empty ||
                   feature.HasExtraData(language);
        }

        public static bool HasExtraData(this IFeature feature, string language)
        {
            return feature.Attributes.GetByLanguage(FeatureAttributes.DESCRIPTION, language) != string.Empty ||
                   feature.Attributes.GetNames().Any(n => n.StartsWith(FeatureAttributes.IMAGE_URL));
        }

        public static long GetOsmId(this IFeature feature)
        {
            return GetOsmId(feature.Attributes[FeatureAttributes.ID].ToString());
        }

        public static OsmGeoType GetOsmType(this IFeature feature)
        {
            return GetOsmType(feature.Attributes[FeatureAttributes.ID].ToString());
        }

        public static long GetOsmId(string id)
        {
            return long.Parse(id.Split("_").Last());
        }

        public static OsmGeoType GetOsmType(string id)
        {
            return Enum.Parse<OsmGeoType>(id.Split("_").First(), true);
        }

        public static DateTime GetLastModified(this IFeature feature)
        {
            if (!feature.Attributes.Exists(FeatureAttributes.POI_LAST_MODIFIED))
            {
                return DateTime.Now;
            }
            return DateTime.Parse(feature.Attributes[FeatureAttributes.POI_LAST_MODIFIED].ToString());
        }

        public static void SetLastModified(this IFeature feature, DateTime dateTime)
        {
            feature.Attributes.SetLastModified(dateTime);
        }

        public static void SetLastModified(this IAttributesTable table, DateTime dateTime)
        {
            table.AddOrUpdate(FeatureAttributes.POI_LAST_MODIFIED, dateTime.ToString("o"));
        }
    }
}
