using System;
using System.Collections.Generic;
using System.Linq;
using IsraelHiking.API.Converters;
using IsraelHiking.DataAccessInterfaces;
using NetTopologySuite.Features;
using NetTopologySuite.Geometries;
using OsmSharp.Collections.Tags;
using OsmSharp.Osm;

namespace IsraelHiking.API.Services
{
    public class OsmGeoJsonPreprocessor : IOsmGeoJsonPreprocessor
    {
        private const string PLACE = "place";
        private const string ICON = "icon";
        private const string SEARCH_FACTOR = "search_factor";

        private readonly ILogger _logger;
        private readonly IOsmGeoJsonConverter _osmGeoJsonConverter;

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

        public OsmGeoJsonPreprocessor(ILogger logger,
            IOsmGeoJsonConverter osmGeoJsonConverter)
        {
            _logger = logger;
            _osmGeoJsonConverter = osmGeoJsonConverter;
        }

        public Dictionary<string, List<Feature>> Preprocess(Dictionary<string, List<ICompleteOsmGeo>> osmNamesDictionary)
        {
            _logger.Info("Preprocessing OSM data to GeoJson, total distict names: " + osmNamesDictionary.Keys.Count);
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
                    _logger.Debug($"https://www.openstreetmap.org/{(g.Geometry.GeometryType == "Polygon" ? "way" : "relation")}/{g.Attributes["osm_id"]} {isValidOp.ValidationError.Message}({isValidOp.ValidationError.Coordinate.X},{isValidOp.ValidationError.Coordinate.Y})");
                }
            });
            
            _logger.Info("Finished converting OSM data to GeoJson, Starting GeoJson preprocessing");
            var containers = geoJsonNamesDictionary.Values.SelectMany(v => v).Where(f =>
                !(f.Geometry is MultiLineString) &&
                !(f.Geometry is LineString) &&
                !(f.Geometry is MultiPoint) &&
                !(f.Geometry is Point)).ToList();
            _logger.Info("Total possible containers: " + containers.Count);
            var counter = 0;
            foreach (var features in geoJsonNamesDictionary.Values)
            {
                PreprocessGeoJson(features, containers);
                counter++;
                if (counter % 5000 == 0)
                {
                    _logger.Info($"Finished processing {counter} features");
                }
            }
            _logger.Info("Finished GeoJson preprocessing");
            return geoJsonNamesDictionary;
        }

        private void PreprocessGeoJson(List<Feature> features, List<Feature> containers)
        {
            MergePlacesPoints(features);
            foreach (var feature in features)
            {
                AddAddressField(feature, containers);
                var propertiesExtraData = GeoJsonFeatureHelper.FindPropertiesData(feature);
                feature.Attributes.AddAttribute(SEARCH_FACTOR, propertiesExtraData?.SearchFactor ?? PropertiesData.DEFAULT_SEARCH_FACTOR);
                feature.Attributes.AddAttribute(ICON, propertiesExtraData?.Icon ?? string.Empty);
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
                feature.Attributes.AddAttribute("lat", placePoint.Geometry.Coordinate.Y);
                feature.Attributes.AddAttribute("lng", placePoint.Geometry.Coordinate.X);
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
                        _logger.Debug($"Issue with contains test for: {f.Geometry.GeometryType}_{f.Attributes["osm_id"]}: feature.Geometry is not valid: {isValidOp.ValidationError.Message} at: ({isValidOp.ValidationError.Coordinate.X},{isValidOp.ValidationError.Coordinate.Y})");
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
                feature.Attributes.AddAttribute(addressName, containingGeoJson.Attributes[attributeName]);
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
                    var wayToMergeTo =
                        mergedWays.FirstOrDefault(
                            mw =>
                                mw.Nodes.Last().Id == wayToMerge.Nodes.First().Id ||
                                mw.Nodes.First().Id == wayToMerge.Nodes.Last().Id ||
                                mw.Nodes.First().Id == wayToMerge.Nodes.First().Id ||
                                mw.Nodes.Last().Id == wayToMerge.Nodes.Last().Id);
                    if (wayToMergeTo == null)
                    {
                        continue;
                    }
                    if (wayToMerge.Nodes.First().Id == wayToMergeTo.Nodes.First().Id ||
                        wayToMerge.Nodes.Last().Id == wayToMergeTo.Nodes.Last().Id)
                    {
                        wayToMerge.Nodes.Reverse();
                    }
                    var nodes = wayToMerge.Nodes;
                    if (nodes.Last().Id == wayToMergeTo.Nodes.First().Id)
                    {
                        nodes.Remove(nodes.Last());
                        wayToMergeTo.Nodes.InsertRange(0, nodes);
                    }
                    else if (nodes.First().Id == wayToMergeTo.Nodes.Last().Id)
                    {
                        nodes.Remove(nodes.First());
                        wayToMergeTo.Nodes.AddRange(nodes);
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

        private void MergeTags(ICompleteOsmGeo fromItem, ICompleteOsmGeo toItem)
        {
            foreach (var tag in fromItem.Tags.Except(toItem.Tags, new TagKeyComparer()))
            {
                toItem.Tags.Add(tag);
            }
        }
    }
}
