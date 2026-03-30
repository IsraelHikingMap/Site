using NetTopologySuite.Features;
using NetTopologySuite.Geometries;
using OsmSharp;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Text.Json.Serialization;
using NetTopologySuite.IO.Converters;

namespace IsraelHiking.Common.Extensions;

public static class GeoJsonExtensions
{
    public static readonly JsonConverterFactory GeoJsonWritableFactory = new GeoJsonConverterFactory(new GeometryFactory(), false, null, RingOrientationOption.EnforceRfc9746, true);

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
        if (feature.Attributes.Exists("name:" + language))
        {
            return feature.Attributes.GetOptionalValue("name:" + language) as string;
        }
        if (feature.Attributes.Exists("name:en"))
        {
            return feature.Attributes["name:en"].ToString();
        }
        if (feature.Attributes.Exists("name"))
        {
            return feature.Attributes["name"].ToString();
        }
        if (feature.Attributes.Exists("mtb:name:" + language))
        {
            return feature.Attributes["mtb:name:" + language].ToString();
        }
        if (feature.Attributes.Exists("mtb:name:en"))
        {
            return feature.Attributes["mtb:name:en"].ToString();
        }
        if (feature.Attributes.Exists("mtb:name"))
        {
            return feature.Attributes["mtb:name"].ToString();
        }
        return string.Empty;
    }

    public static string GetDescription(this IFeature feature, string language)
    {
        if (feature.Attributes.Exists(FeatureAttributes.DESCRIPTION + ":" + language))
        {
            return feature.Attributes[FeatureAttributes.DESCRIPTION + ":" + language].ToString();
        }
        if (feature.Attributes.Exists(FeatureAttributes.DESCRIPTION))
        {
            return feature.Attributes[FeatureAttributes.DESCRIPTION].ToString();
        }
        return string.Empty;

    }

    public static string GetDescriptionWithExternal(this IFeature feature, string language)
    {
        string[] suffixes = [":" + language, ""];
        foreach (var suffix in suffixes)
        {
            foreach (var prefix in FeatureAttributes.POI_DESCRIPTION_KEYS)
            {
                var attr = prefix + suffix;
                if (feature.Attributes.Exists(attr))
                {
                    return feature.Attributes[attr].ToString();
                }

            }

        }
        return string.Empty;
    }

    public static List<string> GetStringListFromAttributeValue(object value)
    {
        var titles = new List<string>();
        switch (value)
        {
            case string str:
                titles.Add(str);
                break;
            case IEnumerable<string> stringsEnumerable:
                titles.AddRange(stringsEnumerable);
                break;
            case IEnumerable<object> objectsEnumerable:
                titles.AddRange(objectsEnumerable.Select(o => o.ToString()).ToList());
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
        return !string.IsNullOrEmpty(feature.GetDescription(language)) ||
               feature.Attributes.GetNames().Any(n => n.StartsWith(FeatureAttributes.IMAGE_URL)) ||
               feature.Attributes.GetNames().Any(n => n.Contains(FeatureAttributes.MTB_NAME));
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

    public static Coordinate GetLocation(this IFeature feature)
    {
        if (feature.Attributes[FeatureAttributes.POI_GEOLOCATION] is not IAttributesTable locationTable)
        {
            throw new InvalidOperationException($"Missing location for feature with id {feature.GetId()}");
        }
        var y = double.Parse(locationTable[FeatureAttributes.LAT].ToString());
        var x = locationTable.GetNames().Contains(FeatureAttributes.LON) ? double.Parse(locationTable[FeatureAttributes.LON].ToString()) : double.Parse(locationTable[FeatureAttributes.LNG].ToString());
        var location = new Coordinate
        {
            Y = y,
            X = x
        };
        return location;
    }

    public static void SetLocation(this IFeature feature, Coordinate geoLocation)
    {
        feature.Attributes.SetLocation(geoLocation);
    }

    public static void SetLocation(this IAttributesTable table, Coordinate geoLocation)
    {
        var geoLocationTable = new AttributesTable
        {
            {FeatureAttributes.LAT, geoLocation.Y},
            {FeatureAttributes.LON, geoLocation.X},
            {FeatureAttributes.LNG, geoLocation.X}
        };
        table.AddOrUpdate(FeatureAttributes.POI_GEOLOCATION, geoLocationTable);
    }

    public static bool GeometryContains(this IFeature feature, IFeature otherFeature)
    {
        if (otherFeature.Geometry is GeometryCollection geometryCollectionOther)
        {
            if (feature.Geometry is GeometryCollection geometryCollection)
            {
                return geometryCollectionOther.Geometries.Any(og => geometryCollection.Geometries.Any(gc => gc.Contains(og)));
            }
            return geometryCollectionOther.Geometries.Any(og => feature.Geometry.Contains(og));
        }
        else
        {
            if (feature.Geometry is GeometryCollection geometryCollection)
            {
                return geometryCollection.Geometries.Any(gcs => gcs.Contains(otherFeature.Geometry));
            }
            return feature.Geometry.Contains(otherFeature.Geometry);
        }
    }

    public static void MergeGeometriesFrom(this IFeature target, IFeature source, GeometryFactory geometryFactory)
    {
        if (target.Geometry is GeometryCollection geometryCollection)
        {
            if (source.Geometry is GeometryCollection geometryCollectionSource)
            {
                target.Geometry = geometryFactory.CreateGeometryCollection(geometryCollection.Geometries.Concat(geometryCollectionSource.Geometries).ToArray());
            }
            else
            {
                target.Geometry = geometryFactory.CreateGeometryCollection(geometryCollection.Geometries.Concat([source.Geometry
                ]).ToArray());
            }
        }
        else
        {
            if (source.Geometry is GeometryCollection geometryCollectionSource)
            {
                target.Geometry = geometryFactory.CreateGeometryCollection(new[] { target.Geometry }.Concat(geometryCollectionSource.Geometries).ToArray());
            }
            else
            {
                target.Geometry = geometryFactory.CreateGeometryCollection([target.Geometry, source.Geometry]);
            }
        }
    }
}