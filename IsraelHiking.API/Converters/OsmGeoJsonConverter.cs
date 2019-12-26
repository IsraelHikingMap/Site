using GeoAPI.Geometries;
using IsraelHiking.Common;
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
        private const string SUBAREA = "subarea";
        private const string BOUNDARY = "boundary";
        private const string TYPE = "type";
        private const string MULTIPOLYGON = "multipolygon";
        private readonly GeometryFactory _geometryFactory;

        /// <summary>
        /// Class constrcutor
        /// </summary>
        /// <param name="geometryFactory"></param>
        public OsmGeoJsonConverter(GeometryFactory geometryFactory)
        {
            _geometryFactory = geometryFactory;
        }

        /// <inheritdoc />
        public Feature ToGeoJson(ICompleteOsmGeo completeOsmGeo)
        {
            if (completeOsmGeo.Tags.Count == 0)
            {
                return null;
            }
            switch (completeOsmGeo.Type)
            {
                case OsmGeoType.Node:
                    var node = completeOsmGeo as Node;
                    return new Feature(_geometryFactory.CreatePoint(ConvertNode(node)), ConvertTags(node));
                case OsmGeoType.Way:
                    if (!(completeOsmGeo is CompleteWay way) || way.Nodes.Length <= 1)
                    {
                        // can't convert a way with 1 coordinates to geojson.
                        return null;
                    }
                    var properties = ConvertTags(way);
                    properties.AddAttribute(FeatureAttributes.POI_OSM_NODES, way.Nodes.Select(n => n.Id).ToArray());
                    var geometry = GetGeometryFromNodes(way.Nodes);
                    return new Feature(geometry, properties);
                case OsmGeoType.Relation:
                    return ConvertRelation(completeOsmGeo as CompleteRelation);
                default:
                    return null;
            }
        }

        private IAttributesTable ConvertTags(ICompleteOsmGeo osmObject)
        {
            var table = new AttributesTable(osmObject.Tags.ToDictionary(t => t.Key, t => t.Value as object))
            {
                {FeatureAttributes.ID, osmObject.Type.ToString().ToLower() + "_" + osmObject.Id}
            };
            if (osmObject.TimeStamp.HasValue)
            {
                table.Add(FeatureAttributes.POI_LAST_MODIFIED, osmObject.TimeStamp.Value.ToString("o"));
            }
            if (!string.IsNullOrWhiteSpace(osmObject.UserName))
            {
                table.Add(FeatureAttributes.POI_USER_NAME, osmObject.UserName);
                table.Add(FeatureAttributes.POI_USER_ADDRESS, $"https://www.openstreetmap.org/user/{Uri.EscapeUriString(osmObject.UserName)}");
            }
            return table;
        }

        private Coordinate ConvertNode(Node node)
        {
            return new Coordinate(node.Longitude ?? 0, node.Latitude ?? 0, double.NaN);
        }

        private List<Geometry> GetGeometriesFromWays(IEnumerable<CompleteWay> ways)
        {
            var nodesGroups = new List<List<Node>>();
            var waysToGroup = new List<CompleteWay>(ways.Where(w => w.Nodes.Any()));
            while (waysToGroup.Any())
            {
                var wayToGroup = waysToGroup.FirstOrDefault(w =>
                    nodesGroups.Any(g => CanBeLinked(w.Nodes, g.ToArray())));

                if (wayToGroup == null)
                {
                    nodesGroups.Add(new List<Node>(waysToGroup.First().Nodes));
                    waysToGroup.RemoveAt(0);
                    continue;
                }
                var currentNodes = new List<Node>(wayToGroup.Nodes);
                waysToGroup.Remove(wayToGroup);
                var group = nodesGroups.First(g => CanBeLinked(currentNodes.ToArray(), g.ToArray()));
                if (currentNodes.First().Id == group.First().Id || currentNodes.Last().Id == group.Last().Id)
                {
                    currentNodes.Reverse(); // direction of this way is incompatible with other ways.
                }
                if (currentNodes.First().Id == group.Last().Id)
                {
                    currentNodes.Remove(currentNodes.First());
                    group.AddRange(currentNodes);
                    continue;
                }
                currentNodes.Remove(currentNodes.Last());
                group.InsertRange(0, currentNodes);
            }
            return nodesGroups.Select(g => GetGeometryFromNodes(g.ToArray())).ToList();
        }

        private bool CanBeLinked(Node[] nodes1, Node[] nodes2)
        {
            return nodes1.Last().Id == nodes2.First().Id
                   || nodes1.First().Id == nodes2.Last().Id
                   || nodes1.First().Id == nodes2.First().Id
                   || nodes1.Last().Id == nodes2.Last().Id;
        }

        private Feature ConvertRelation(CompleteRelation relation)
        {
            if (IsMultipolygon(relation))
            {
                return ConvertToMultipolygon(relation);
            }

            var nodes = relation.Members.Select(m => m.Member).OfType<Node>().ToList();
            if (nodes.Any())
            {
                var multiPoint = _geometryFactory.CreateMultiPoint(nodes.Select(n => _geometryFactory.CreatePoint(ConvertNode(n))).ToArray());
                return new Feature(multiPoint, ConvertTags(relation));
            }

            var geometries = GetGeometriesFromWays(GetAllWays(relation));
            if (!geometries.Any())
            {
                return null;
            }
            var jointLines = geometries.OfType<LineString>().ToList();
            jointLines.AddRange(geometries.OfType<Polygon>().Select(p => _geometryFactory.CreateLineString(p.Coordinates) as LineString));
            var multiLineString = _geometryFactory.CreateMultiLineString(jointLines.ToArray());
            return new Feature(multiLineString, ConvertTags(relation));
        }

        private Feature ConvertToMultipolygon(CompleteRelation relation)
        {
            var allWaysInRelationByRole = GetAllWaysGroupedByRole(relation);
            var outerWays = allWaysInRelationByRole.Where(kvp => kvp.Key == OUTER).SelectMany(kvp => kvp.Value).ToList();
            var outerPolygons = GetGeometriesFromWays(outerWays).OfType<Polygon>().ToList();
            outerPolygons = MergePolygons(outerPolygons);
            var innerWays = allWaysInRelationByRole.Where(kvp => kvp.Key != OUTER).SelectMany(kvp => kvp.Value).ToList();
            var innerPolygons = GetGeometriesFromWays(innerWays).OfType<Polygon>().ToList();
            innerPolygons = MergePolygons(innerPolygons);
            MergeInnerIntoOuterPolygon(ref outerPolygons, ref innerPolygons);
            var multiPolygon = _geometryFactory.CreateMultiPolygon(outerPolygons.Union(innerPolygons).ToArray());
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
                var merged = UnaryUnionOp.Union(polygons.Cast<IGeometry>().ToList());
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

        private void MergeInnerIntoOuterPolygon(ref List<Polygon> outerPolygons, ref List<Polygon> innerPolygons)
        {
            var newOuterPolygons = new List<Polygon>();
            foreach (var outerPolygon in outerPolygons)
            {
                var currentInnerPolygons = innerPolygons.Where(p => p.Within(outerPolygon)).ToArray();
                var holes = currentInnerPolygons.Select(p => _geometryFactory.CreateLinearRing(p.Coordinates)).ToArray();
                innerPolygons = innerPolygons.Except(currentInnerPolygons).ToList();
                newOuterPolygons.Add(_geometryFactory.CreatePolygon(_geometryFactory.CreateLinearRing(outerPolygon.Coordinates), holes) as Polygon);
            }
            outerPolygons = newOuterPolygons;
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

        private Geometry GetGeometryFromNodes(Node[] nodes)
        {
            var coordinates = nodes.Select(ConvertNode).ToArray();
            return nodes.First().Id == nodes.Last().Id && nodes.Length >= 4
                        ? _geometryFactory.CreatePolygon(_geometryFactory.CreateLinearRing(coordinates)) as Geometry
                        : _geometryFactory.CreateLineString(coordinates) as Geometry;
        }
    }
}
