using IsraelHiking.Common;
using IsraelHiking.Common.Extensions;
using NetTopologySuite.Features;
using NetTopologySuite.Geometries;
using NetTopologySuite.Operation.Union;
using OsmSharp;
using OsmSharp.Complete;
using System;
using System.Collections.Generic;
using System.Linq;

namespace IsraelHiking.API.Converters
{
    /// <inheritdoc />
    public class OsmGeoJsonConverter : IOsmGeoJsonConverter
    {
        private const string OUTER = "outer";
        private const string INNER = "inner";
        private const string SUBAREA = "subarea";
        private const string BOUNDARY = "boundary";
        private const string TYPE = "type";
        private const string MULTIPOLYGON = "multipolygon";
        private readonly GeometryFactory _geometryFactory;

        /// <summary>
        /// Class constructor
        /// </summary>
        /// <param name="geometryFactory"></param>
        public OsmGeoJsonConverter(GeometryFactory geometryFactory)
        {
            _geometryFactory = geometryFactory;
        }

        /// <inheritdoc />
        public IFeature ToGeoJson(ICompleteOsmGeo completeOsmGeo)
        {
            if (completeOsmGeo?.Tags == null || completeOsmGeo.Tags.Count == 0)
            {
                return null;
            }
            try
            {
                switch (completeOsmGeo.Type)
                {
                    case OsmGeoType.Node:
                        var node = completeOsmGeo as Node;
                        return new Feature(_geometryFactory.CreatePoint(ConvertNode(node)), ConvertTags(node));
                    case OsmGeoType.Way:
                        if (!(completeOsmGeo is CompleteWay way) || way.Nodes.Length <= 1)
                        {
                            // can't convert a way with 1 coordinates to GeoJSON.
                            return null;
                        }
                        var properties = ConvertTags(way);
                        properties.Add(FeatureAttributes.POI_OSM_NODES, way.Nodes.Select(n => n.Id).ToArray());
                        var geometry = GetGeometryFromNodes(way.Nodes, true);
                        return new Feature(geometry, properties);
                    case OsmGeoType.Relation:
                        return ConvertRelation(completeOsmGeo as CompleteRelation);
                    default:
                        return null;
                }
            }
            catch
            {
                return null;
            }
        }

        private IAttributesTable ConvertTags(ICompleteOsmGeo osmObject)
        {
            var table = new AttributesTable(osmObject.Tags.ToDictionary(t => t.Key, t => t.Value as object))
            {
                {FeatureAttributes.ID, osmObject.GetId()}
            };
            if (osmObject.TimeStamp.HasValue)
            {
                table.SetLastModified(osmObject.TimeStamp.Value);
            }
            if (!string.IsNullOrWhiteSpace(osmObject.UserName))
            {
                table.Add(FeatureAttributes.POI_USER_NAME, osmObject.UserName);
                table.Add(FeatureAttributes.POI_USER_ADDRESS, $"https://www.openstreetmap.org/user/{Uri.EscapeDataString(osmObject.UserName)}");
            }
            if (osmObject.Version.HasValue)
            {
                table.Add(FeatureAttributes.POI_VERSION, osmObject.Version.Value);
            }
            return table;
        }

        private Coordinate ConvertNode(Node node)
        {
            return new CoordinateZ(_geometryFactory.PrecisionModel.MakePrecise(node.Longitude ?? 0),
                _geometryFactory.PrecisionModel.MakePrecise(node.Latitude ?? 0),
                double.NaN);
        }

        private List<Geometry> GetGeometriesFromWays(IEnumerable<CompleteWay> ways, bool closePolygons)
        {
            var nodesGroups = new List<List<Node>>();
            var waysToGroup = new List<CompleteWay>(ways.Where(w => w.Nodes.Any()));
            while (waysToGroup.Any())
            {
                var wayToGroup = waysToGroup.FirstOrDefault(w =>
                    nodesGroups.Any(g => CanBeMerged(w.Nodes, g)));

                if (wayToGroup == null)
                {
                    nodesGroups.Add(new List<Node>(waysToGroup.First().Nodes));
                    waysToGroup.RemoveAt(0);
                    continue;
                }
                var currentNodes = new List<Node>(wayToGroup.Nodes);
                waysToGroup.Remove(wayToGroup);
                var group = nodesGroups.First(g => CanBeMerged(currentNodes, g));
                if (CanBeReverseMerged(group, currentNodes))
                {
                    if (wayToGroup.Tags != null &&
                        ((wayToGroup.Tags.ContainsKey("oneway") && wayToGroup.Tags["oneway"] == "yes") ||
                        (wayToGroup.Tags.ContainsKey("oneway:mtb") && wayToGroup.Tags["oneway:mtb"] == "yes")))
                    {
                        group.Reverse();
                    }
                    else
                    {
                        currentNodes.Reverse(); // direction of this way is incompatible with other ways.
                    }
                }
                if (currentNodes.First().Id == group.Last().Id)
                {
                    currentNodes.RemoveAt(0);
                    group.AddRange(currentNodes);
                    continue;
                }
                currentNodes.RemoveAt(currentNodes.Count - 1); // must use indexes since the same reference can be used at the start and end
                group.InsertRange(0, currentNodes);
            }
            var nodes = closePolygons 
                ? nodesGroups.Select(SplitListByLoops).SelectMany(g => g).ToList()
                : RearrangeInCaseOfCircleAndLine(nodesGroups);

            return nodes.Select(g => GetGeometryFromNodes(g.ToArray(), closePolygons)).ToList();
        }

        private bool CanBeMerged(IEnumerable<Node> nodes1, IEnumerable<Node> nodes2)
        {
            return nodes1.Last().Id == nodes2.First().Id ||
                   nodes1.First().Id == nodes2.Last().Id ||
                   CanBeReverseMerged(nodes1, nodes2);
        }

        private bool CanBeReverseMerged(IEnumerable<Node> nodes1, IEnumerable<Node> nodes2)
        {
            return nodes1.First().Id == nodes2.First().Id ||
                   nodes1.Last().Id == nodes2.Last().Id;
        }

        private Feature ConvertRelation(CompleteRelation relation)
        {
            if (IsMultipolygon(relation))
            {
                return ConvertToMultipolygon(relation);
            }

            var nodes = relation.Members.Select(m => m.Member).OfType<Node>().ToList();
            if (nodes.Any() && nodes.Count == relation.Members.Length)
            {
                var multiPoint = _geometryFactory.CreateMultiPoint(nodes.Select(n => _geometryFactory.CreatePoint(ConvertNode(n))).ToArray());
                return new Feature(multiPoint, ConvertTags(relation));
            }

            var geometries = GetGeometriesFromWays(GetAllWays(relation), false);
            if (!geometries.Any())
            {
                return null;
            }
            var multiLineString = _geometryFactory.CreateMultiLineString(geometries.Cast<LineString>().ToArray());
            return new Feature(multiLineString, ConvertTags(relation));
        }

        private Feature ConvertToMultipolygon(CompleteRelation relation)
        {
            var allWaysInRelationByRole = GetAllWaysGroupedByRole(relation);
            var outerWays = allWaysInRelationByRole.Where(kvp => kvp.Key == OUTER).SelectMany(kvp => kvp.Value).ToList();
            var outerPolygons = GetGeometriesFromWays(outerWays, true).OfType<Polygon>().ToList();
            var innerWays = allWaysInRelationByRole.Where(kvp => kvp.Key == INNER).SelectMany(kvp => kvp.Value).ToList();
            var innerPolygons = GetGeometriesFromWays(innerWays, true).OfType<Polygon>().ToList();
            var multiPolygon = MergeInnerIntoOuterPolygon(outerPolygons, innerPolygons);
            return new Feature(multiPolygon, ConvertTags(relation));
        }

        private List<Polygon> MergePolygons(List<Polygon> polygons)
        {
            if (!polygons.Any())
            {
                return polygons;
            }
            try
            {
                var merged = CascadedPolygonUnion.Union(polygons.ToArray());
                if (merged is MultiPolygon multipolygon)
                {
                    return multipolygon.Geometries.Cast<Polygon>().ToList();
                }
                return new List<Polygon> { merged as Polygon };
            }
            catch
            {
                return polygons;
            }
        }

        private MultiPolygon MergeInnerIntoOuterPolygon(List<Polygon> outerPolygons, List<Polygon> innerPolygons)
        {
            var newOuterPolygons = new List<Polygon>();
            outerPolygons = MergePolygons(outerPolygons);
            foreach (var outerPolygon in outerPolygons)
            {
                // remove all inner holes from outer polygon
                var newOuterPolygon = _geometryFactory.CreatePolygon((LinearRing)outerPolygon.ExteriorRing.Copy());
                // get inner polygons
                var currentInnerPolygons = innerPolygons.Where(p => p.Within(newOuterPolygon)).ToArray();
                if (!currentInnerPolygons.Any())
                {
                    newOuterPolygons.Add(newOuterPolygon);
                    continue;
                }
                var holesPolygons = currentInnerPolygons.Select(p => _geometryFactory.CreatePolygon(p.ExteriorRing.Copy() as LinearRing)).ToArray();
                var holesUnifiedGeometry = CascadedPolygonUnion.Union(holesPolygons);
                // adding the difference between the outer polygon and all the holes inside it
                newOuterPolygons.Add(newOuterPolygon.Difference(holesUnifiedGeometry) as Polygon);
                // update list for next loop cycle
                innerPolygons = innerPolygons.Except(currentInnerPolygons).ToList();
            }
            return _geometryFactory.CreateMultiPolygon(newOuterPolygons.Union(innerPolygons).ToArray());
        }

        /// <summary>
        /// A static method that gets all the ways from a relation recursively
        /// </summary>
        /// <param name="relation"></param>
        /// <returns></returns>
        public static List<CompleteWay> GetAllWays(CompleteRelation relation)
        {
            return GetAllWaysGroupedByRole(relation).SelectMany(kvp => kvp.Value).ToList();
        }

        private static Dictionary<string, List<CompleteWay>> GetAllWaysGroupedByRole(CompleteRelation relation)
        {
            var dictionary = relation.Members.GroupBy(m => m.Role ?? string.Empty)
                .ToDictionary(g => g.Key, g => g.Select(k => k.Member)
                .OfType<CompleteWay>().ToList());
            if (relation.Members.All(m => m.Member.Type != OsmGeoType.Relation))
            {
                return dictionary;
            }
            var subRelations = relation.Members.Where(m => m.Role != SUBAREA).Select(m => m.Member).OfType<CompleteRelation>();
            foreach (var subRelation in subRelations)
            {
                var subRelationDictionary = GetAllWaysGroupedByRole(subRelation);
                foreach (var key in subRelationDictionary.Keys)
                {
                    if (dictionary.ContainsKey(key))
                    {
                        dictionary[key].AddRange(subRelationDictionary[key]);
                    }
                    else
                    {
                        dictionary[key] = subRelationDictionary[key];
                    }
                }
            }
            return dictionary;
        }

        private bool IsMultipolygon(ICompleteOsmGeo relation)
        {
            if (relation.Tags.ContainsKey(TYPE) == false)
            {
                return false;
            }
            return relation.Tags[TYPE] == MULTIPOLYGON || relation.Tags[TYPE] == BOUNDARY;
        }

        private Geometry GetGeometryFromNodes(Node[] nodes, bool closePolygons)
        {
            var coordinates = nodes.Select(ConvertNode).ToArray();
            return nodes.First().Id == nodes.Last().Id && nodes.Length >= 4 && closePolygons
                        ? _geometryFactory.CreatePolygon(_geometryFactory.CreateLinearRing(coordinates)) as Geometry
                        : _geometryFactory.CreateLineString(coordinates) as Geometry;
        }

        /// <summary>
        /// This split by loop algorithm looks for duplicate ids inside a list of nodes,
        /// removes the shortest list between two duplicate ids and recursively adds these loops to a list
        /// The reasoning behind this algorithm is that when converting a list of nodes to polygons you need
        /// to split the different polygons to avoid creating invalid polygon that intersect itself
        /// </summary>
        /// <param name="nodes"></param>
        /// <returns>A list of list with valid polygons or lines</returns>
        private List<List<Node>> SplitListByLoops(List<Node> nodes)
        {
            var groups = nodes.GroupBy(n => n.Id);
            var isSimplePolygon = nodes.First().Id == nodes.Last().Id &&
                groups.Count(g => g.Count() == 2) == 1 &&
                groups.Count(g => g.Count() > 2) == 0;
            if (groups.All(g => g.Count() == 1) || isSimplePolygon)
            {
                return new List<List<Node>> { nodes };
            }
            var duplicateIdentifiers = groups.Where(g => g.Count() > 1).Select(g => g.First().Id);
            var minimalIndexStart = -1;
            var minimalIndexEnd = -1;
            // find shortest loop:
            foreach (var duplicateIdentifier in duplicateIdentifiers)
            {
                var firstIndex = -1;
                var lastIndex = -1;
                for (int nodeIndex = 0; nodeIndex < nodes.Count; nodeIndex++)
                {
                    if (nodes[nodeIndex].Id == duplicateIdentifier)
                    {
                        if (firstIndex == -1)
                        {
                            firstIndex = nodeIndex;
                        }
                        else
                        {
                            lastIndex = nodeIndex;
                        }
                        if (lastIndex == -1 || firstIndex == -1)
                        {
                            continue;
                        }
                        if (minimalIndexStart == -1 || lastIndex - firstIndex < minimalIndexEnd - minimalIndexStart)
                        {
                            minimalIndexStart = firstIndex;
                            minimalIndexEnd = lastIndex;
                        }
                    }
                }
            }
            // remove the loop:
            var list = new List<List<Node>>();
            var loop = nodes.Skip(minimalIndexStart).Take(minimalIndexEnd - minimalIndexStart + 1).ToList();
            list.Add(loop);
            var leftNodes = nodes.Take(minimalIndexStart).Concat(nodes.Skip(minimalIndexEnd)).ToList();
            // run this again on the nodes without the above loop
            return list.Concat(SplitListByLoops(leftNodes)).ToList();
        }

        /// <summary>
        /// The purpose of this method is to take grouped results that grouped into "O" shape and lines that
        /// touches this "O" shape and turn them into a "Q" shape.
        /// This should only be applied to multiline strings
        /// It does so by going over all the circles, finding lines that are not circles that touches those
        /// and reorder the points, adding a new line and removes the circle and the line from the original list
        /// </summary>
        /// <param name="nodeGroups">The original list of list of nodes to alter</param>
        /// <returns>A new list of list of nodes after the changes</returns>
        private List<List<Node>> RearrangeInCaseOfCircleAndLine(List<List<Node>> nodeGroups)
        {
            if (nodeGroups.Count == 1)
            {
                return nodeGroups;
            }
            var circles = nodeGroups.Where(g => g.First().Id == g.Last().Id).ToList();
            if (!circles.Any())
            {
                return nodeGroups;
            }
            foreach (var circle in circles)
            {
                var lineThatTouchesTheCircle = nodeGroups
                    .Except(circles).FirstOrDefault(g => circle
                        .Any(n => n.Id == g.First().Id || n.Id == g.Last().Id));
                if (lineThatTouchesTheCircle == null)
                {
                    continue;
                }
                nodeGroups.Remove(circle);
                nodeGroups.Remove(lineThatTouchesTheCircle);
                var nodeInCircleThatTouches = circle.FirstOrDefault(n => n.Id == lineThatTouchesTheCircle.Last().Id);
                if (nodeInCircleThatTouches != null)
                {
                    var indexInCircle = circle.IndexOf(nodeInCircleThatTouches);
                    var newList = lineThatTouchesTheCircle;
                    newList.AddRange(circle.Skip(indexInCircle + 1).ToList());
                    newList.AddRange(circle.Skip(1).Take(indexInCircle));
                    nodeGroups.Add(newList);
                    continue;
                }
                nodeInCircleThatTouches = circle.FirstOrDefault(n => n.Id == lineThatTouchesTheCircle.First().Id);
                if (nodeInCircleThatTouches != null)
                {
                    var indexInCircle = circle.IndexOf(nodeInCircleThatTouches);
                    var newList = circle.Skip(1).Take(indexInCircle - 1).ToList();
                    newList.AddRange(lineThatTouchesTheCircle);
                    newList.InsertRange(0, circle.Skip(indexInCircle));
                    nodeGroups.Add(newList);
                }
            }
            return nodeGroups;
        }
    }
}
