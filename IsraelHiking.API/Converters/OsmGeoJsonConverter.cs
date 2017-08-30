using System.Collections.Generic;
using System.Linq;
using GeoAPI.Geometries;
using IsraelHiking.Common;
using NetTopologySuite.Features;
using NetTopologySuite.Geometries;
using OsmSharp.Complete;
using OsmSharp;

namespace IsraelHiking.API.Converters
{
    /// <inheritdoc />
    public class OsmGeoJsonConverter : IOsmGeoJsonConverter
    {
        private const string OUTER = "outer";
        private const string BOUNDARY = "boundary";
        private const string TYPE = "type";
        private const string MULTIPOLYGON = "multipolygon";

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
                    return new Feature(new Point(ConvertNode(node)), ConvertTags(node));
                case OsmGeoType.Way:
                    var way = completeOsmGeo as CompleteWay;
                    if (way == null || way.Nodes.Length <= 1)
                    {
                        // can't convert a way with 1 coordinates to geojson.
                        return null;
                    }
                    var properties = ConvertTags(way);
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
            var properties = osmObject.Tags.ToDictionary(t => t.Key, t => t.Value);
            properties.Add(FeatureAttributes.ID, osmObject.Id.ToString());
            properties.Add(FeatureAttributes.POI_SOURCE, Sources.OSM);
            if (properties.ContainsKey(FeatureAttributes.WEBSITE) == false)
            {
                properties.Add(FeatureAttributes.WEBSITE, $"{Sources.OSM_ADDRESS}{osmObject.Type.ToString().ToLower()}/{osmObject.Id}");
            }
            var table = new AttributesTable();
            foreach (var key in properties.Keys)
            {
                table.AddAttribute(key, properties[key]);
            }
            return table;
        }

        private Coordinate ConvertNode(Node node)
        {
            return new Coordinate(node.Longitude ?? 0, node.Latitude ?? 0);
        }

        private List<IGeometry> GetGeometriesFromWays(IEnumerable<CompleteWay> ways)
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
                var multiPoint = new MultiPoint(nodes.Select(n => new Point(ConvertNode(n)) as IPoint).ToArray());
                return new Feature(multiPoint, ConvertTags(relation));
            }

            var geometries = GetGeometriesFromWays(GetAllWays(relation));
            if (!geometries.Any())
            {
                return null;
            }
            var jointLines = geometries.OfType<ILineString>().ToList();
            jointLines.AddRange(geometries.OfType<Polygon>().Select(p => new LineString(p.Coordinates) as ILineString));
            var multiLineString = new MultiLineString(jointLines.ToArray());
            return new Feature(multiLineString, ConvertTags(relation));
        }

        private Feature ConvertToMultipolygon(CompleteRelation relation)
        {
            var outerWays = GetAllWaysGroupedByRole(relation).Where(kvp => kvp.Key == OUTER).SelectMany(kvp => kvp.Value).ToList();
            var outerPolygons = GetGeometriesFromWays(outerWays).OfType<IPolygon>().ToList();
            var innerWays = GetAllWaysGroupedByRole(relation).Where(kvp => kvp.Key != OUTER).SelectMany(kvp => kvp.Value).ToList();
            var innerPolygons = GetGeometriesFromWays(innerWays).OfType<IPolygon>().ToList();
            MergeInnerIntoOuterPolygon(ref outerPolygons, ref innerPolygons);
            var multiPolygon = new MultiPolygon(outerPolygons.Union(innerPolygons).ToArray());
            return new Feature(multiPolygon, ConvertTags(relation));
        }

        private void MergeInnerIntoOuterPolygon(ref List<IPolygon> outerPolygons, ref List<IPolygon> innerPolygons)
        {
            var newOuterPolygons = new List<IPolygon>();
            foreach (var outerPolygon in outerPolygons)
            {
                var currentInnerPolygons = innerPolygons.Where(p => p.Within(outerPolygon)).ToArray();
                var holes = currentInnerPolygons.Select(p => new LinearRing(p.Coordinates) as ILinearRing).ToArray();
                innerPolygons = innerPolygons.Except(currentInnerPolygons).ToList();
                newOuterPolygons.Add(new Polygon(new LinearRing(outerPolygon.Coordinates), holes));
            }
            outerPolygons = newOuterPolygons;
        }

        /// <summary>
        /// A static method that gets all the ways from a relation recursivly
        /// </summary>
        /// <param name="relation"></param>
        /// <returns></returns>
        public static List<CompleteWay> GetAllWays(CompleteRelation relation)
        {
            return GetAllWaysGroupedByRole(relation).SelectMany(kvp => kvp.Value).ToList();
        }

        private static Dictionary<string, List<CompleteWay>> GetAllWaysGroupedByRole(CompleteRelation relation)
        {
            var dicionary = relation.Members.GroupBy(m => m.Role ?? string.Empty)
                .ToDictionary(g => g.Key, g => g.Select(k => k.Member)
                .OfType<CompleteWay>().ToList());
            if (relation.Members.All(m => m.Member.Type != OsmGeoType.Relation))
            {
                return dicionary;
            }
            var subRelations = relation.Members.Select(m => m.Member).OfType<CompleteRelation>();
            foreach (var subRelation in subRelations)
            {
                var subRelationDictionary = GetAllWaysGroupedByRole(subRelation);
                foreach (var key in subRelationDictionary.Keys)
                {
                    if (dicionary.ContainsKey(key))
                    {
                        dicionary[key].AddRange(subRelationDictionary[key]);
                    }
                    else
                    {
                        dicionary[key] = subRelationDictionary[key];
                    }
                }
            }
            return dicionary;
        }

        private bool IsMultipolygon(ICompleteOsmGeo relation)
        {
            if (relation.Tags.ContainsKey(BOUNDARY))
            {
                return true;
            }
            if (relation.Tags.ContainsKey(TYPE) == false)
            {
                return false;
            }
            return relation.Tags[TYPE] == MULTIPOLYGON || relation.Tags[TYPE] == BOUNDARY;
        }

        private IGeometry GetGeometryFromNodes(Node[] nodes)
        {
            var coordinates = nodes.Select(ConvertNode).ToArray();
            return nodes.First().Id == nodes.Last().Id && nodes.Length >= 4
                        ? new Polygon(new LinearRing(coordinates)) as IGeometry
                        : new LineString(coordinates);
        }
    }
}
