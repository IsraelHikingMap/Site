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
                        : new Feature(new LineString(coordinates), properties);
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
                var group = nodesGroups.FirstOrDefault(g => currentNodes.Last() == g.First() 
                || currentNodes.First() == g.Last()
                || currentNodes.First() == g.First() 
                || currentNodes.Last() == g.Last());
                if (group == null)
                {
                    group = currentNodes;
                    nodesGroups.Add(group);
                    continue;
                }
                if (currentNodes.First() == group.First() || currentNodes.Last() == group.Last())
                {
                    currentNodes.Reverse(); // direction of this way is incompatible with other ways.
                }
                if (currentNodes.First() == group.Last())
                {
                    currentNodes.Remove(currentNodes.First());
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
            }).ToList();
        }

        private Feature ConvertRelation(CompleteRelation relation)
        {
            if (IsMultipolygon(relation))
            {
                var multiPolygon = new MultiPolygon();
                var outerWays = relation.Members.Where(m => m.Role == "outer").Select(m => m.Member).OfType<CompleteWay>();
                var outerCoordinatesGroups = GetCoordinatesGroupsFromWays(outerWays);
                multiPolygon.Coordinates.AddRange(outerCoordinatesGroups.OfType<Polygon>());
                var innerWays = relation.Members.Where(m => m.Role != "outer").Select(m => m.Member).OfType<CompleteWay>();
                var innerCoordinatesGroups = GetCoordinatesGroupsFromWays(innerWays);
                if (innerCoordinatesGroups.OfType<Polygon>().Any())
                {
                    multiPolygon.Coordinates.AddRange(innerCoordinatesGroups.OfType<Polygon>());
                }
                return new Feature(multiPolygon, ConvertTags(relation.Tags, relation.Id));
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

        public static List<CompleteWay> GetAllWays(CompleteRelation relation)
        {
            if (relation.Members.All(m => m.Member.Type != CompleteOsmType.Relation))
            {
                return relation.Members.Select(m => m.Member).OfType<CompleteWay>().ToList();
            }
            var list = relation.Members.Select(m => m.Member).OfType<CompleteWay>().ToList();
            var subRelations = relation.Members.Select(m => m.Member).OfType<CompleteRelation>();
            foreach (var subRelation in subRelations)
            {
                list.AddRange(GetAllWays(subRelation));
            }
            return list;
        }

        private bool IsMultipolygon(CompleteOsmBase relation)
        {
            if (relation.Tags.ContainsKey("boundary"))
            {
                return true;
            }
            if (relation.Tags.ContainsKey("type") == false)
            {
                return false;
            }
            return relation.Tags["type"] == "multipolygon" || relation.Tags["type"] == "boundary";
        }
    }
}
