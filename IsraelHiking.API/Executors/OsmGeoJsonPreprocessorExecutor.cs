using IsraelHiking.API.Converters;
using IsraelHiking.API.Services;
using IsraelHiking.Common;
using IsraelHiking.Common.Extensions;
using Microsoft.Extensions.Logging;
using NetTopologySuite.Features;
using NetTopologySuite.Geometries;
using NetTopologySuite.Operation.Valid;
using OsmSharp.Complete;
using System.Collections.Generic;
using System.Linq;

namespace IsraelHiking.API.Executors;

/// <inheritdoc />
public class OsmGeoJsonPreprocessorExecutor : IOsmGeoJsonPreprocessorExecutor
{
    private readonly ILogger _logger;
    private readonly IOsmGeoJsonConverter _osmGeoJsonConverter;
    private readonly ITagsHelper _tagsHelper;

    /// <summary>
    /// Constructor
    /// </summary>
    /// <param name="logger"></param>
    /// <param name="osmGeoJsonConverter"></param>
    /// <param name="tagsHelper"></param>
    public OsmGeoJsonPreprocessorExecutor(ILogger logger,
        IOsmGeoJsonConverter osmGeoJsonConverter,
        ITagsHelper tagsHelper)
    {
        _logger = logger;
        _osmGeoJsonConverter = osmGeoJsonConverter;
        _tagsHelper = tagsHelper;
    }

    /// <inheritdoc />
    public List<IFeature> Preprocess(List<ICompleteOsmGeo> osmEntities)
    {
        _logger.LogInformation("Preprocessing OSM data to GeoJson, total entities: " + osmEntities.Count);
        osmEntities = RemoveDuplicateWaysThatExistInRelations(osmEntities);
        var featuresToReturn = osmEntities.Select(ConvertToFeature).Where(f => f != null).ToList();
        _logger.LogInformation("Finished GeoJson conversion: " + featuresToReturn.Count);
        return featuresToReturn;
    }

    /// <summary>
    /// This function removes ways from the list that are covered by a relation.
    /// </summary>
    /// <param name="osmEntities"></param>
    /// <returns></returns>
    private List<ICompleteOsmGeo> RemoveDuplicateWaysThatExistInRelations(List<ICompleteOsmGeo> osmEntities)
    {
        var relations = osmEntities.OfType<CompleteRelation>();
        var osmByIdDictionary = osmEntities.ToDictionary(o => o.GetId(), o => o);
        foreach (var relation in relations)
        {
            if (relation.Tags == null || !relation.Tags.Any())
            {
                continue;
            }
            var ways = OsmGeoJsonConverter.GetAllWays(relation);
            foreach (var way in ways)
            {
                if (way.Tags == null || !way.Tags.Any())
                {
                    continue;
                }
                if (!osmByIdDictionary.ContainsKey(way.GetId()))
                {
                    continue;
                }
                if (way.Tags.GetName().Equals(relation.Tags.GetName()))
                {
                    osmByIdDictionary.Remove(way.GetId());
                }
            }
        }
        return osmByIdDictionary.Values.ToList();
    }

    private IFeature ConvertToFeature(ICompleteOsmGeo osmEntity)
    {
        var feature = _osmGeoJsonConverter.ToGeoJson(osmEntity);
        if (feature == null)
        {
            _logger.LogError("Unable to convert " + osmEntity);
            return null;
        }
        var isValidOp = new IsValidOp(feature.Geometry);
        if (!isValidOp.IsValid)
        {
            _logger.LogError($"{feature.Geometry.GeometryType} with ID: {feature.Attributes[FeatureAttributes.ID]} {isValidOp.ValidationError.Message} ({isValidOp.ValidationError.Coordinate.X},{isValidOp.ValidationError.Coordinate.Y})");
            return null;
        }
        if (feature.Geometry.IsEmpty)
        {
            // This is the case where partial relations are in the pbf or non-closed ones.
            // This can be checked here: https://tools.geofabrik.de/osmi/?view=areas&lon=35.33202&lat=32.39600&zoom=9&baselayer=Geofabrik%20Standard&overlays=ring_not_closed%2Crole_should_be_inner%2Crole_should_be_outer
            return null;
        }

        var iconColorCategory = _tagsHelper.GetIconColorCategoryForTags(feature.Attributes);
        feature.Attributes.Add(FeatureAttributes.POI_ICON, iconColorCategory.Icon);
        feature.Attributes.Add(FeatureAttributes.POI_ICON_COLOR, iconColorCategory.Color);
        feature.Attributes.Add(FeatureAttributes.POI_CATEGORY, iconColorCategory.Category);
        feature.Attributes.Add(FeatureAttributes.POI_SOURCE, Sources.OSM);
        feature.Attributes.Add(FeatureAttributes.POI_LANGUAGE, Languages.ALL);
        feature.Attributes.Add(FeatureAttributes.POI_LANGUAGES, Languages.Array);
        feature.Attributes.Add(FeatureAttributes.POI_CONTAINER, feature.IsValidContainer());
        foreach (var key in feature.Attributes.GetNames().Where(k => k.Contains(FeatureAttributes.NAME) && !string.IsNullOrWhiteSpace(feature.Attributes[k]?.ToString())).ToList())
        {
            feature.Attributes[key] = feature.Attributes[key].ToString().Trim();
        }
        foreach (var key in feature.Attributes.GetNames().Where(k => k.Contains(FeatureAttributes.DESCRIPTION) && !string.IsNullOrWhiteSpace(feature.Attributes[k]?.ToString())).ToList())
        {
            feature.Attributes[key] = feature.Attributes[key].ToString().Trim();
        }
        feature.SetId();
        UpdateLocation(feature);
        return feature;
    }

    /// <inheritdoc />
    public List<IFeature> Preprocess(List<CompleteWay> highways)
    {
        var highwayFeatures = highways.Select(_osmGeoJsonConverter.ToGeoJson).Where(h => h != null).ToList();
        foreach (var highwayFeature in highwayFeatures)
        {
            highwayFeature.Attributes.Add(FeatureAttributes.POI_SOURCE, Sources.OSM);
            highwayFeature.SetId();
        }
        return highwayFeatures;
    }

    /// <summary>
    /// This is a static function to update the geolocation of a feature for search capabilities
    /// </summary>
    /// <param name="feature"></param>
    private void UpdateLocation(IFeature feature)
    {
        Coordinate geoLocation;
        if (feature.Geometry is LineString or MultiLineString && feature.Geometry.Coordinate != null)
        {
            geoLocation = feature.Geometry.Coordinate;
        }
        else if (feature.Geometry.Centroid == null || feature.Geometry.Centroid.IsEmpty)
        {
            return;
        }
        else
        {
            geoLocation = feature.Geometry.Centroid.Coordinate;
        }
        feature.Attributes.SetLocation(geoLocation);
    }
}