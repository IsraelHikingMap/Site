using System;
using System.Collections.Generic;
using System.Linq;
using IsraelHiking.API.Converters;
using IsraelHiking.API.Services;
using IsraelHiking.Common;
using IsraelHiking.Common.Extensions;
using NetTopologySuite.Features;
using NetTopologySuite.Geometries;
using Microsoft.Extensions.Logging;
using OsmSharp.Tags;
using OsmSharp.Complete;
using OsmSharp;

namespace IsraelHiking.API.Executors
{
    /// <inheritdoc />
    public class OsmGeoJsonPreprocessorExecutor : IOsmGeoJsonPreprocessorExecutor
    {
        private const string PLACE = "place";

        private readonly ILogger _logger;
        private readonly IOsmGeoJsonConverter _osmGeoJsonConverter;
        private readonly ITagsHelper _tagsHelper;

        private class TagKeyComparer : IEqualityComparer<Tag>
        {
            public bool Equals(Tag x, Tag y)
            {
                return x.Key == y.Key;
            }

            public int GetHashCode(Tag obj)
            {
                return obj.Key.GetHashCode();
            }
        }

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
        public List<Feature> Preprocess(Dictionary<string, List<ICompleteOsmGeo>> osmNamesDictionary)
        {
            _logger.LogInformation("Preprocessing OSM data to GeoJson, total distinct names: " + osmNamesDictionary.Keys.Count);
            var geoJsonNamesDictionary = new Dictionary<string, List<Feature>>();
            foreach (var pair in osmNamesDictionary)
            {
                var features = MergeOsmElements(pair.Value)
                        .Select(e => _osmGeoJsonConverter.ToGeoJson(e))
                        .Where(f => f != null)
                        .ToList();
                if (!features.Any())
                {
                    continue;
                }
                AddAttributes(features);
                geoJsonNamesDictionary[pair.Key] = features;
            }

            geoJsonNamesDictionary.Values.SelectMany(v => v).ToList().ForEach(g =>
            {
                var isValidOp = new NetTopologySuite.Operation.Valid.IsValidOp(g.Geometry);
                if (!isValidOp.IsValid)
                {
                    _logger.LogError($"{g.Geometry.GeometryType} with ID: {g.Attributes[FeatureAttributes.ID]} {isValidOp.ValidationError.Message} ({isValidOp.ValidationError.Coordinate.X},{isValidOp.ValidationError.Coordinate.Y})");
                }
                if (g.Geometry.IsEmpty)
                {
                    _logger.LogError($"{g.Geometry.GeometryType} with ID: {g.Attributes[FeatureAttributes.ID]} is an empty geometry - check for non-closed relations.");
                }
            });
            _logger.LogInformation("Finished GeoJson conversion");
            var featuresToReturn = geoJsonNamesDictionary.SelectMany(v => v.Value).ToList();
            ChangeLwnHikingRoutesToNoneCategory(featuresToReturn);
            return featuresToReturn;
        }

        private void AddAttributes(List<Feature> features)
        {
            foreach (var feature in features)
            {
                (var searchFactor, var iconColorCategory) = _tagsHelper.GetInfo(feature.Attributes);
                feature.Attributes.AddAttribute(FeatureAttributes.SEARCH_FACTOR, searchFactor);
                feature.Attributes.AddAttribute(FeatureAttributes.ICON, iconColorCategory.Icon);
                feature.Attributes.AddAttribute(FeatureAttributes.ICON_COLOR, iconColorCategory.Color);
                feature.Attributes.AddAttribute(FeatureAttributes.POI_CATEGORY, iconColorCategory.Category);
                feature.Attributes.AddAttribute(FeatureAttributes.POI_SOURCE, Sources.OSM);
                feature.Attributes.AddAttribute(FeatureAttributes.POI_LANGUAGE, Languages.ALL);
                feature.Attributes.AddAttribute(FeatureAttributes.POI_CONTAINER, feature.IsValidContainer());
                feature.SetTitles();
                UpdateLocation(feature);
            }
        }

        private void ChangeLwnHikingRoutesToNoneCategory(List<Feature> features)
        {
            foreach (var feature in features.Where(feature => feature.Attributes.Has("network", "lwn") &&
                                                              feature.Attributes.Has("route", "hiking")))
            {
                feature.Attributes[FeatureAttributes.POI_CATEGORY] = Categories.NONE;
            }
        }

        private List<Feature> UpdatePlacesGeometry(Feature feature, List<Feature> places)
        {
            if (feature.Geometry is Point == false ||
                feature.Attributes.Exists(PLACE) == false || 
                feature.Attributes.Exists(FeatureAttributes.NAME) == false)
            {
                return new List<Feature>();
            }

            var placeContainers = places.Where(c => c.Attributes.Exists(FeatureAttributes.NAME) &&
                                                    c.Attributes[FeatureAttributes.NAME]
                                                        .Equals(feature.Attributes[FeatureAttributes.NAME]) &&
                                                    c.Geometry.Contains(feature.Geometry) &&
                                                    !c.Geometry.EqualsTopologically(feature.Geometry) &&
                                                    !c.Attributes[FeatureAttributes.ID]
                                                        .Equals(feature.Attributes[FeatureAttributes.ID])
                )
                .OrderBy(f => f.Geometry.Area)
                .ToList();
            if (!placeContainers.Any())
            {
                return placeContainers;
            }
            // setting the geometry of the area to the point to facilitate for updating the place point while showing the area
            var container = placeContainers.First();
            feature.Geometry = container.Geometry;
            feature.Attributes[FeatureAttributes.POI_CONTAINER] = container.Attributes[FeatureAttributes.POI_CONTAINER];
            return placeContainers;
        }

        /// <inheritdoc />
        public List<Feature> MergePlaceNodes(List<Feature> features, List<Feature> containers)
        {
            _logger.LogInformation($"Starting places merging: {features.Count}, places: {containers.Count}");
            var featureIdsToRemove = new List<string>();
            foreach (var feature in features)
            {
                var placesToRemove = UpdatePlacesGeometry(feature, containers);
                if (placesToRemove.Any())
                {
                    // database places are nodes that should not be removed.
                    var ids = placesToRemove.Select(p => p.Attributes[FeatureAttributes.ID].ToString()).ToList();
                    featureIdsToRemove.AddRange(ids);
                }
            }

            _logger.LogInformation($"Finished places merging. Merged places: {featureIdsToRemove.Count}");
            return features.Where(f => featureIdsToRemove.Contains(f.Attributes[FeatureAttributes.ID]) == false).ToList();
        }

        private IEnumerable<ICompleteOsmGeo> MergeOsmElements(IReadOnlyCollection<ICompleteOsmGeo> elements)
        {
            if (elements.Count == 1)
            {
                return elements;
            }
            var nodes = elements.OfType<Node>().ToList();
            var ways = elements.OfType<CompleteWay>().ToList();
            var relations = elements.OfType<CompleteRelation>().ToList();
            if (nodes.Count == elements.Count || relations.Count == elements.Count)
            {
                return elements;
            }
            ways = MergeWaysInRelations(relations, ways);
            ways = MergeWays(ways);
            var mergedElements = new List<ICompleteOsmGeo>();
            mergedElements.AddRange(nodes);
            mergedElements.AddRange(ways);
            mergedElements.AddRange(relations);
            return mergedElements;
        }

        private List<CompleteWay> MergeWaysInRelations(IEnumerable<CompleteRelation> relations, ICollection<CompleteWay> ways)
        {
            var waysToKeep = ways.ToList();
            foreach (var relation in relations)
            {
                foreach (var way in OsmGeoJsonConverter.GetAllWays(relation))
                {
                    var wayToRemove = waysToKeep.FirstOrDefault(w => w.Id == way.Id);
                    if (wayToRemove == null)
                    {
                        continue;
                    }
                    MergeTags(way, relation);
                    waysToKeep.Remove(wayToRemove);
                }
            }
            return waysToKeep;
        }

        /// <summary>
        /// This method create a new list of ways based on the given list. 
        /// The merge is done by looking into the ways' nodes and combine ways which start or end with the same node. 
        /// </summary>
        /// <param name="ways">The ways to merge</param>
        /// <returns>The merged ways</returns>
        private List<CompleteWay> MergeWays(List<CompleteWay> ways)
        {
            if (ways.Any() == false)
            {
                return new List<CompleteWay>();
            }
            var mergedWays = new List<CompleteWay> { ways.First() };
            var waysToMerge = new List<CompleteWay>(ways.Skip(1));
            while (waysToMerge.Any())
            {
                var foundAWayToMergeTo = false;
                for (var index = waysToMerge.Count - 1; index >= 0; index--)
                {
                    var wayToMerge = waysToMerge[index];
                    var wayToMergeTo = mergedWays.FirstOrDefault(mw => CanBeMerged(mw, wayToMerge));
                    if (wayToMergeTo == null)
                    {
                        continue;
                    }
                    if (CanBeReverseMerged(wayToMergeTo, wayToMerge))
                    {
                        if (wayToMerge.Tags.ContainsKey("oneway") && wayToMerge.Tags["oneway"] == "true")
                        {
                            wayToMergeTo.Nodes = wayToMergeTo.Nodes.Reverse().ToArray();
                        }
                        else
                        {
                            wayToMerge.Nodes = wayToMerge.Nodes.Reverse().ToArray();
                        }
                    }
                    var nodes = wayToMerge.Nodes.ToList();
                    if (nodes.Last().Id == wayToMergeTo.Nodes.First().Id)
                    {
                        nodes.Remove(nodes.Last());
                        wayToMergeTo.Nodes = nodes.Concat(wayToMergeTo.Nodes).ToArray();
                    }
                    else if (nodes.First().Id == wayToMergeTo.Nodes.Last().Id)
                    {
                        nodes.Remove(nodes.First());
                        wayToMergeTo.Nodes = wayToMergeTo.Nodes.Concat(nodes).ToArray();
                    }

                    MergeTags(wayToMerge, wayToMergeTo);
                    waysToMerge.Remove(wayToMerge);
                    foundAWayToMergeTo = true;
                }

                if (foundAWayToMergeTo)
                {
                    continue;
                }

                mergedWays.Add(waysToMerge.First());
                waysToMerge.RemoveAt(0);
            }
            return mergedWays;
        }

        private bool CanBeMerged(CompleteWay way1, CompleteWay way2)
        {
            return way1.Nodes.Last().Id == way2.Nodes.First().Id ||
                   way1.Nodes.First().Id == way2.Nodes.Last().Id ||
                   CanBeReverseMerged(way1, way2);
        }

        private bool CanBeReverseMerged(CompleteWay way1, CompleteWay way2)
        {
            return way1.Nodes.First().Id == way2.Nodes.First().Id ||
                   way1.Nodes.Last().Id == way2.Nodes.Last().Id;
        }

        private void MergeTags(ICompleteOsmGeo fromItem, ICompleteOsmGeo toItem)
        {
            foreach (var tag in fromItem.Tags.Except(toItem.Tags, new TagKeyComparer()))
            {
                toItem.Tags.Add(tag);
            }
        }

        /// <inheritdoc />
        public List<Feature> Preprocess(List<CompleteWay> highways)
        {
            var highwayFeatures = highways.Select(_osmGeoJsonConverter.ToGeoJson).Where(h => h != null).ToList();
            foreach (var highwayFeature in highwayFeatures)
            {
                highwayFeature.Attributes.AddAttribute(FeatureAttributes.POI_SOURCE, Sources.OSM);
            }
            return highwayFeatures;
        }

        /// <summary>
        /// This is a static function to update the geolocation of a feature for search capabilities
        /// </summary>
        /// <param name="feature"></param>
        public static void UpdateLocation(Feature feature)
        {
            if ((feature.Geometry is LineString || feature.Geometry is MultiLineString) && feature.Geometry.Coordinate != null)
            {
                var geoLocationTable = new AttributesTable
                {
                    {FeatureAttributes.LAT, feature.Geometry.Coordinate.Y},
                    {FeatureAttributes.LON, feature.Geometry.Coordinate.X}
                };
                feature.Attributes.AddAttribute(FeatureAttributes.GEOLOCATION, geoLocationTable);
                return;
            }
            if (feature.Geometry.Centroid == null || feature.Geometry.Centroid.IsEmpty)
            {
                return;
            }
            var table = new AttributesTable
            {
                {FeatureAttributes.LAT, feature.Geometry.Centroid.Y},
                {FeatureAttributes.LON, feature.Geometry.Centroid.X}
            };
            feature.Attributes.AddAttribute(FeatureAttributes.GEOLOCATION, table);
        }
    }
}
