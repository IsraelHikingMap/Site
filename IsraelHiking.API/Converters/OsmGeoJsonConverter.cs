using System.Collections.Generic;
using System.Linq;
using GeoJSON.Net.Feature;
using GeoJSON.Net.Geometry;
using OsmSharp.Collections.Tags;
using OsmSharp.Osm;

namespace IsraelHiking.API.Converters
{
    public class OsmGeoJsonConverter
    {
        private const string OUTER = "outer";
        private const string BOUNDARY = "boundary";
        private const string TYPE = "type";
        private const string MULTIPOLYGON = "multipolygon";

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
                    if (way == null || way.Nodes.Count <= 1)
                    {
                        // can't convert a way with 1 coordinates to geojson.
                        return null;
                    }
                    var properties = ConvertTags(way.Tags, way.Id);
                    var geometry = GetGeometryFromNodes(way.Nodes);
                    return new Feature(geometry, properties);
                case CompleteOsmType.Relation:
                    return ConvertRelation(completeOsmGeo as CompleteRelation);
                default:
                    return null;
            }
        }

        private Dictionary<string, object> ConvertTags(TagsCollectionBase tags, long id)
        {
            var properties = tags.ToStringObjectDictionary();
            properties.Add("osm_id", id);
            return properties;
        }

        private GeographicPosition ConvertNode(Node node)
        {
            return new GeographicPosition(node.Latitude.Value, node.Longitude.Value);
        }

        private List<IGeometryObject> GetCoordinatesGroupsFromWays(IEnumerable<CompleteWay> ways)
        {
            var nodesGroups = new List<List<Node>>();
            var waysToGroup = new List<CompleteWay>(ways);
            while (waysToGroup.Any())
            {
                var currentNodes = new List<Node>(waysToGroup.First().Nodes);
                waysToGroup.RemoveAt(0);
                var group = nodesGroups.FirstOrDefault(g => currentNodes.Last().Id == g.First().Id 
                || currentNodes.First().Id == g.Last().Id
                || currentNodes.First().Id == g.First().Id 
                || currentNodes.Last().Id == g.Last().Id);
                if (group == null)
                {
                    group = currentNodes;
                    nodesGroups.Add(group);
                    continue;
                }
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
            return nodesGroups.Select(GetGeometryFromNodes).ToList();
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
                var multiPoint = new MultiPoint(nodes.Select(n => new Point(ConvertNode(n))).ToList());
                return new Feature(multiPoint, ConvertTags(relation.Tags, relation.Id));
            }

            var coordinatesGroups = GetCoordinatesGroupsFromWays(GetAllWays(relation));
            if (!coordinatesGroups.Any())
            {
                return null;
            }
            var multiLineString = new MultiLineString(coordinatesGroups.OfType<LineString>().ToList());
            multiLineString.Coordinates.AddRange(coordinatesGroups.OfType<Polygon>().SelectMany(p => p.Coordinates));
            return new Feature(multiLineString, ConvertTags(relation.Tags, relation.Id));
        }

        private Feature ConvertToMultipolygon(CompleteRelation relation)
        {
            var multiPolygon = new MultiPolygon();
            var outerWays = GetAllWaysByRole(relation).Where(kvp => kvp.Key == OUTER).SelectMany(kvp => kvp.Value).ToList();
            var outerCoordinatesGroups = GetCoordinatesGroupsFromWays(outerWays);
            multiPolygon.Coordinates.AddRange(outerCoordinatesGroups.OfType<Polygon>());
            var innerWays = GetAllWaysByRole(relation).Where(kvp => kvp.Key != OUTER).SelectMany(kvp => kvp.Value).ToList();
            var innerCoordinatesGroups = GetCoordinatesGroupsFromWays(innerWays).OfType<Polygon>().ToList();
            multiPolygon.Coordinates.AddRange(innerCoordinatesGroups);
            return new Feature(multiPolygon, ConvertTags(relation.Tags, relation.Id));
        }

        public static List<CompleteWay> GetAllWays(CompleteRelation relation)
        {
            return GetAllWaysByRole(relation).SelectMany(kvp => kvp.Value).ToList();
        }

        private static Dictionary<string, List<CompleteWay>> GetAllWaysByRole(CompleteRelation relation)
        {
            var dicionary = relation.Members.GroupBy(m => m.Role ?? string.Empty)
                .ToDictionary(g => g.Key, g => g.Select(k => k.Member).OfType<CompleteWay>().ToList());
            if (relation.Members.All(m => m.Member.Type != CompleteOsmType.Relation))
            {
                return dicionary;
            }
            var subRelations = relation.Members.Select(m => m.Member).OfType<CompleteRelation>();
            foreach (var subRelation in subRelations)
            {
                var subRelationDictionary = GetAllWaysByRole(subRelation);
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

        private bool IsMultipolygon(CompleteOsmBase relation)
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

        private IGeometryObject GetGeometryFromNodes(List<Node> nodes)
        {
            var coordinates = nodes.Select(ConvertNode);
            return nodes.First().Id == nodes.Last().Id && nodes.Count >= 4
                        ? new Polygon(new List<LineString> { new LineString(coordinates) }) as IGeometryObject
                        : new LineString(coordinates);
        }
    }
}
