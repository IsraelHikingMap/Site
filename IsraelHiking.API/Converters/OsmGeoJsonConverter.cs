using System.Collections.Generic;
using System.Linq;
using GeoJSON.Net.Feature;
using GeoJSON.Net.Geometry;
using OsmSharp.Collections.Tags;
//using OsmSharp.Geo.Attributes;
//using OsmSharp.Geo.Features;
//using OsmSharp.Geo.Geometries;
//using OsmSharp.Math.Geo;
using OsmSharp.Osm;

namespace IsraelHiking.API.Converters
{
    public class OsmGeoJsonConverter
    {
        public Feature ToGeoJson(ICompleteOsmGeo completeOsmGeo)
        {
            if (completeOsmGeo.Tags.Count == 0)
            {
                return null;
            }
            switch (completeOsmGeo.Type)
            {
                case CompleteOsmType.Node:
                    var node = completeOsmGeo as Node;
                    return new Feature(new Point(ConvertNode(node)), ConvertTags(node.Tags, node.Id.Value));
                case CompleteOsmType.Way:
                    var way = completeOsmGeo as CompleteWay;
                    if (way.Nodes.Count <= 1)
                    {
                        // can't convert a way with 1 coordinates to geojson.
                        return null;
                    }
                    var coordinates = way.Nodes.Select(ConvertNode);
                    var properties = ConvertTags(way.Tags, way.Id);
                    return way.Nodes.First() == way.Nodes.Last() && way.Nodes.Count >= 4
                        ? new Feature(new Polygon(new List<LineString> { new LineString(coordinates) }), properties)
                        //? new Feature(new Polygon(new LineairRing(coordinates)), properties)
                        : new Feature(new LineString(coordinates), properties);
                case CompleteOsmType.Relation:
                    return ConvertRelation(completeOsmGeo as CompleteRelation);
                default:
                    return null;
            }
        }

        //public FeatureCollection ToGeoJson(ICompleteOsmGeo completeOsmGeo)
        //{
        //    var collection = new FeatureCollection();
        //    var nodes = osm.Nodes;
        //    var ways = osm.Ways;
        //    var relations = osm.Relations;
        //    foreach (var node in nodes.Values.Where(n => n.Tags.Count > 0))
        //    {
        //        var point = new Point(ConvertNode(node));
        //        collection.Add(new Feature(point, ConvertTags(node.Tags, node.Id.Value)));
        //    }
        //    foreach (var way in ways.Values.Where(n => n.Tags.Count > 0))
        //    {
        //        var coordinates = GetCoordinates(way.Nodes, nodes);
        //        var properties = ConvertTags(way.Tags, way.Id.Value);
        //        collection.Add(way.Nodes.First() == way.Nodes.Last()
        //            ? new Feature(new Polygon(new LineairRing(coordinates)), properties)
        //            : new Feature(new LineString(coordinates), properties));
        //    }
        //    foreach (var relation in relations.Values.Where(n => n.Tags.Count > 0))
        //    {
        //        if (relation.Tags["type"] == "multipolygon")
        //        {
        //            var multiPolygon = new MultiPolygon();
        //            var outerWaysIds = relation.Members.Where(m => m.MemberRole == "outer" && m.MemberId.HasValue).Select(m => m.MemberId.Value);
        //            var outerCoordinatesGroups = GetCoordinatesGroupsFromWays(outerWaysIds, ways, nodes);
        //            // remove these ways from the feature collection?
        //            if (outerCoordinatesGroups.OfType<LineairRing>().Count() != 1)
        //            {
        //                // there should be only one group of coordinates in an outer multipolygon relation.
        //                continue;
        //            }
        //            multiPolygon.Add(new Polygon(outerCoordinatesGroups.OfType<LineairRing>().First()));
        //            var innerWaysIds = relation.Members.Where(m => m.MemberRole != "outer" && m.MemberId.HasValue).Select(m => m.MemberId.Value);
        //            var innerCoordinatesGroups = GetCoordinatesGroupsFromWays(innerWaysIds, ways, nodes);
        //            if (innerCoordinatesGroups.OfType<LineairRing>().Any())
        //            {
        //                // ignoring non linear rings in relation (partial holes)
        //                multiPolygon.AddRange(innerCoordinatesGroups.OfType<LineairRing>().Select(coordinates => new Polygon(coordinates)));
        //            }
        //            collection.Add(new Feature(multiPolygon, ConvertTags(relation.Tags, relation.Id.Value)));
        //        }
        //        else
        //        { 
        //            var multiLineString = new MultiLineString();
        //            var wayIds = relation.Members.Where(m => m.MemberId.HasValue).Select(m => m.MemberId.Value);
        //            var coordinatesGroups = GetCoordinatesGroupsFromWays(wayIds, ways, nodes);
        //            if (!coordinatesGroups.Any())
        //            {
        //                continue;
        //            }
        //            multiLineString.AddRange(coordinatesGroups.Select(coordinates => coordinates));
        //            collection.Add(new Feature(multiLineString, ConvertTags(relation.Tags, relation.Id.Value)));
        //        }
        //    }
        //    return collection;
        //}

        //private GeometryAttributeCollection ConvertTags(TagsCollectionBase tags, long id)
        //{
        //    var arrtibutes = new SimpleGeometryAttributeCollection();
        //    foreach (var tag in tags)
        //    {
        //        arrtibutes.Add(new GeometryAttribute { Key = tag.Key, Value = tag.Value });
        //    }
        //    arrtibutes.Add("osm_id", id);
        //    return arrtibutes;
        //}

        private Dictionary<string, object> ConvertTags(TagsCollectionBase tags, long id)
        {
            var properties = new Dictionary<string, object>();
            foreach (var tag in tags)
            {
                properties.Add(tag.Key, tag.Value);
            }
            properties.Add("osm_id", id);
            return properties;
        }

        //private GeoCoordinate ConvertNode(Node node)
        //{
        //    return new GeoCoordinate(node.Latitude.Value, node.Longitude.Value);
        //}

        private GeographicPosition ConvertNode(Node node)
        {
            return new GeographicPosition(node.Latitude.Value, node.Longitude.Value);
        }

        //private GeoCoordinate[] GetCoordinates(IEnumerable<long> nodeIds, Dictionary<long, Node> nodes)
        //{
        //    return nodeIds.Select(nodeId => ConvertNode(nodes[nodeId])).ToArray();
        //}

        //private List<LineString> GetCoordinatesGroupsFromWays(IEnumerable<long> waysIds, Dictionary<long, Way> ways, Dictionary<long, Node> nodes)
        //{
        //    var nodeIdsGroups = new List<List<long>>();
        //    var waysToGroup = waysIds.Select(waysId => ways[waysId]).ToList();
        //    while (waysToGroup.Any())
        //    {
        //        var currentNodeIds = new List<long>(waysToGroup.First().Nodes);
        //        waysToGroup.RemoveAt(0);
        //        var group = nodeIdsGroups.FirstOrDefault(g => currentNodeIds.Last() == g.First() || currentNodeIds.First() == g.Last());
        //        if (group == null)
        //        {
        //            group = currentNodeIds;
        //            nodeIdsGroups.Add(group);
        //            continue;
        //        }
        //        if (currentNodeIds.Last() == group.First() && currentNodeIds.First() == group.Last())
        //        {
        //            currentNodeIds.RemoveAll(n => n == currentNodeIds.Last() || n == currentNodeIds.First());
        //            group.AddRange(currentNodeIds);
        //            continue;
        //        }
        //        if (currentNodeIds.First() == group.Last())
        //        {
        //            currentNodeIds.RemoveAt(0);
        //            group.AddRange(currentNodeIds);
        //            continue;
        //        }
        //        currentNodeIds.Remove(currentNodeIds.Last());
        //        group.InsertRange(0, currentNodeIds);
        //    }
        //    return nodeIdsGroups.Select(nodeIdsGroup =>
        //    {
        //        var coordinates = GetCoordinates(nodeIdsGroup, nodes);
        //        return nodeIdsGroup.First() == nodeIdsGroup.Last() ? new LineairRing(coordinates) : new LineString(coordinates);
        //    }).ToList();
        //}

        private List<IGeometryObject> GetCoordinatesGroupsFromWays(IEnumerable<CompleteWay> ways)
        //private List<LineString> GetCoordinatesGroupsFromWays(IEnumerable<CompleteWay> ways)
        {
            var nodesGroups = new List<List<Node>>();
            var waysToGroup = new List<CompleteWay>(ways);
            while (waysToGroup.Any())
            {
                var currentNodes = new List<Node>(waysToGroup.First().Nodes);
                waysToGroup.RemoveAt(0);
                var group =
                    nodesGroups.FirstOrDefault(g => currentNodes.Last() == g.First() || currentNodes.First() == g.Last());
                if (group == null)
                {
                    group = currentNodes;
                    nodesGroups.Add(group);
                    continue;
                }
                if (currentNodes.Last() == group.First() && currentNodes.First() == group.Last())
                {
                    currentNodes.RemoveAll(n => n == currentNodes.Last() || n == currentNodes.First());
                    group.AddRange(currentNodes);
                    continue;
                }
                if (currentNodes.First() == group.Last())
                {
                    currentNodes.RemoveAt(0);
                    group.AddRange(currentNodes);
                    continue;
                }
                currentNodes.Remove(currentNodes.Last());
                group.InsertRange(0, currentNodes);
            }
            return nodesGroups.Select(nodes =>
            {
                var coordinates = nodes.Select(ConvertNode);
                return nodes.First() == nodes.Last() && nodes.Count >= 4
                    ? new Polygon(new List<LineString> {new LineString(coordinates)}) as IGeometryObject
                    : new LineString(coordinates) as IGeometryObject;
                    //? new LineairRing(coordinates)
                    //: new LineString(coordinates);
            }).ToList();
        }

        private Feature ConvertRelation(CompleteRelation relation)
        {
            if (relation.Tags.ContainsKey("type") && relation.Tags["type"] == "multipolygon")
            {
                var multiPolygon = new MultiPolygon();
                var outerWays = relation.Members.Where(m => m.Role == "outer").Select(m => m.Member).OfType<CompleteWay>();
                var outerCoordinatesGroups = GetCoordinatesGroupsFromWays(outerWays);
                // remove these ways from the feature collection?
                //if (outerCoordinatesGroups.OfType<LineairRing>().Count() != 1)
                if (outerCoordinatesGroups.OfType<Polygon>().Count() != 1)
                {
                    // there should be only one group of coordinates in an outer multipolygon relation.
                    return null;
                }
                multiPolygon.Coordinates.Add(outerCoordinatesGroups.OfType<Polygon>().First());
                //multiPolygon.Add(new Polygon(outerCoordinatesGroups.OfType<LineairRing>().First()));
                var innerWays = relation.Members.Where(m => m.Role != "outer").Select(m => m.Member).OfType<CompleteWay>();
                var innerCoordinatesGroups = GetCoordinatesGroupsFromWays(innerWays);
                //if (innerCoordinatesGroups.OfType<LineairRing>().Any())
                if (innerCoordinatesGroups.OfType<Polygon>().Any())
                {
                    // ignoring non linear rings in relation (partial holes)
                    multiPolygon.Coordinates.AddRange(innerCoordinatesGroups.OfType<Polygon>());
                    //multiPolygon.AddRange(innerCoordinatesGroups.OfType<LineairRing>().Select(l => new Polygon(l)));
                }
                return new Feature(multiPolygon, ConvertTags(relation.Tags, relation.Id));
            }

            var ways = relation.Members.Select(m => m.Member).OfType<CompleteWay>();
            var coordinatesGroups = GetCoordinatesGroupsFromWays(ways);
            if (!coordinatesGroups.Any())
            {
                return null;
            }
            var multiLineString = new MultiLineString(coordinatesGroups.OfType<LineString>().ToList());
            return new Feature(multiLineString, ConvertTags(relation.Tags, relation.Id));
        }
    }
}
