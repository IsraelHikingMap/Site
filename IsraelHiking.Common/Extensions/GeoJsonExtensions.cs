using NetTopologySuite.Features;
using NetTopologySuite.Geometries;
using OsmSharp;
using System;
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
        if (language == Languages.DEFAULT && feature.Attributes.Exists("name"))
        {
            return feature.Attributes["name"].ToString();
        }
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
        var x = double.Parse(locationTable[FeatureAttributes.LNG].ToString());
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
            {FeatureAttributes.LNG, geoLocation.X}
        };
        table.AddOrUpdate(FeatureAttributes.POI_GEOLOCATION, geoLocationTable);
    }

}