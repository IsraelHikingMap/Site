using System;
using System.Collections.Generic;
using System.Linq;
using IsraelHiking.API.Converters;
using IsraelHiking.API.Services;
using IsraelHiking.Common;
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
        private readonly IGeoJsonFeatureHelper _geoJsonFeatureHelper;

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
        /// <param name="geoJsonFeatureHelper"></param>
        public OsmGeoJsonPreprocessorExecutor(ILogger logger,
            IOsmGeoJsonConverter osmGeoJsonConverter,
            IGeoJsonFeatureHelper geoJsonFeatureHelper)
        {
            _logger = logger;
            _osmGeoJsonConverter = osmGeoJsonConverter;
            _geoJsonFeatureHelper = geoJsonFeatureHelper;
        }

        /// <inheritdoc />
        public Dictionary<string, List<Feature>> Preprocess(Dictionary<string, List<ICompleteOsmGeo>> osmNamesDictionary)
        {
            _logger.LogInformation("Preprocessing OSM data to GeoJson, total distict names: " + osmNamesDictionary.Keys.Count);
            var geoJsonNamesDictionary = new Dictionary<string, List<Feature>>();
            foreach (var pair in osmNamesDictionary)
            {
                var osmList = MergeOsmElements(pair.Value)
                        .Select(e => _osmGeoJsonConverter.ToGeoJson(e))
                        .Where(f => f != null)
                        .ToList();
                if (osmList.Any())
                {
                    geoJsonNamesDictionary[pair.Key] = osmList;
                }
            }

            geoJsonNamesDictionary.Values.SelectMany(v => v).ToList().ForEach(g =>
            {
                var isValidOp = new NetTopologySuite.Operation.Valid.IsValidOp(g.Geometry);
                if (!isValidOp.IsValid)
                {
                    _logger.LogError($"{g.Attributes["externalUrl"]} {isValidOp.ValidationError.Message} ({isValidOp.ValidationError.Coordinate.X},{isValidOp.ValidationError.Coordinate.Y})");
                }
            });
            
            _logger.LogInformation("Finished converting OSM data to GeoJson, Starting GeoJson preprocessing");
            var containers = geoJsonNamesDictionary.Values.SelectMany(v => v).Where(f =>
                !(f.Geometry is MultiLineString) &&
                !(f.Geometry is LineString) &&
                !(f.Geometry is MultiPoint) &&
                !(f.Geometry is Point)).ToList();
            _logger.LogInformation("Total possible containers: " + containers.Count);
            var counter = 0;
            foreach (var features in geoJsonNamesDictionary.Values)
            {
                PreprocessGeoJson(features, containers);
                counter++;
                if (counter % 5000 == 0)
                {
                    _logger.LogInformation($"Finished processing {counter} names of {geoJsonNamesDictionary.Values.Count}");
                }
            }
            _logger.LogInformation("Finished GeoJson preprocessing");
            return geoJsonNamesDictionary;
        }

        private void PreprocessGeoJson(List<Feature> features, List<Feature> containers)
        {
            MergePlacesPoints(features);
            foreach (var feature in features)
            {
                AddAddressField(feature, containers);
                feature.Attributes.AddAttribute(FeatureAttributes.SEARCH_FACTOR, _geoJsonFeatureHelper.GetSearchFactor(feature));
                feature.Attributes.AddAttribute(FeatureAttributes.ICON, _geoJsonFeatureHelper.GetIcon(feature));
                feature.Attributes.AddAttribute(FeatureAttributes.ICON_COLOR, _geoJsonFeatureHelper.GetIconColor(feature));
                feature.Attributes.AddAttribute(FeatureAttributes.POI_CATEGORY, _geoJsonFeatureHelper.GetPoiCategory(feature));
                UpdateLocation(feature);
            }
        }

        private void MergePlacesPoints(List<Feature> list)
        {
            var placesPoints = list.Where(f => f.Geometry is Point && f.Attributes.GetNames().Contains(PLACE)).ToList();
            var nonPlacesPoints = list.Except(placesPoints)
                .Where(f => f.Geometry is Polygon || f.Geometry is MultiPolygon)
                .OrderByDescending(f => f.Attributes.GetNames().Contains(PLACE))
                .ToList();
            foreach (var feature in nonPlacesPoints)
            {
                var placePoint = placesPoints.FirstOrDefault(p => p.Geometry.Within(feature.Geometry));
                if (placePoint == null)
                {
                    continue;
                }
                feature.Attributes.AddAttribute(FeatureAttributes.GEOLOCATION, 
                    new AttributesTable {
                        { FeatureAttributes.LAT, placePoint.Geometry.Coordinate.Y },
                        { FeatureAttributes.LON, placePoint.Geometry.Coordinate.X }
                    });
                foreach (var placePointAttributeName in placePoint.Attributes.GetNames())
                {
                    if (feature.Attributes.GetNames().Contains(placePointAttributeName) == false)
                    {
                        feature.Attributes.AddAttribute(placePointAttributeName, placePoint.Attributes[placePointAttributeName]);
                    }
                }
                list.Remove(placePoint);
                placesPoints.Remove(placePoint);
            }
        }

        private void AddAddressField(Feature feature, List<Feature> containers)
        {
            if (!(feature.Geometry is Point) && !(feature.Geometry is LineString))
            {
                return;
            }
            Feature invalidFeature = null;
            var containingGeoJson = containers.FirstOrDefault(f =>
            {
                try
                {
                    return f != feature && f.Geometry.Contains(feature.Geometry);
                }
                catch (Exception)
                {
                    var isValidOp = new NetTopologySuite.Operation.Valid.IsValidOp(f.Geometry);
                    if (!isValidOp.IsValid)
                    {
                        _logger.LogError($"Issue with contains test for: {f.Geometry.GeometryType}_{f.Attributes[FeatureAttributes.ID]}: feature.Geometry is not valid: {isValidOp.ValidationError.Message} at: ({isValidOp.ValidationError.Coordinate.X},{isValidOp.ValidationError.Coordinate.Y})");
                    }
                    invalidFeature = f;
                    return false;
                }
            });
            if (invalidFeature != null)
            {
                containers.Remove(invalidFeature);
            }
            if (containingGeoJson == null)
            {
                return;
            }
            foreach (var attributeName in containingGeoJson.Attributes.GetNames().Where(n => n.StartsWith("name")))
            {
                var addressName = attributeName.Replace("name", "address");
                if (feature.Attributes.Exists(addressName))
                {
                    feature.Attributes[addressName] = containingGeoJson.Attributes[attributeName];
                }
                else
                { 
                    feature.Attributes.AddAttribute(addressName, containingGeoJson.Attributes[attributeName]);
                }
            }
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
            return highways.Select(_osmGeoJsonConverter.ToGeoJson).Where(h => h != null).ToList();
        }

        /// <summary>
        /// This is a static function to update the geolocation of a feature for search capabilities
        /// </summary>
        /// <param name="feature"></param>
        public static void UpdateLocation(Feature feature)
        {
            if (feature.Attributes.GetNames().FirstOrDefault(n => n == FeatureAttributes.GEOLOCATION) != null)
            {
                return;
            }
            if (feature.Geometry.Coordinate == null)
            {
                return;
            }
            feature.Attributes.AddAttribute(FeatureAttributes.GEOLOCATION, new AttributesTable {
                { FeatureAttributes.LAT, feature.Geometry.Coordinate.Y },
                { FeatureAttributes.LON, feature.Geometry.Coordinate.X }
            });
        }
    }
}
