﻿using System.Linq;
using IsraelHiking.API.Converters;
using Microsoft.VisualStudio.TestTools.UnitTesting;
using NetTopologySuite.Geometries;
using OsmSharp;
using OsmSharp.Tags;
using OsmSharp.Complete;

namespace IsraelHiking.API.Tests.Converters
{
    [TestClass]
    public class OsmGeoJsonConverterTests
    {
        private const string NAME = "name";
        private OsmGeoJsonConverter _converter;

        private Node CreateNode(int number)
        {
            return new Node
            {
                Longitude = number,
                Latitude = number,
                Id = number
            };
        }

        private Node CreateNode(int number, double latitude, double logitude)
        {
            return new Node
            {
                Longitude = logitude,
                Latitude = latitude,
                Id = number
            };
        }

        [TestInitialize]
        public void TestInitialize()
        {
            _converter = new OsmGeoJsonConverter();
        }

        [TestMethod]
        public void ToGeoJson_NoTags_ShouldReturnNull()
        {
            var feature = _converter.ToGeoJson(new Node { Tags = new TagsCollection() });

            Assert.IsNull(feature);
        }

        [TestMethod]
        public void ToGeoJson_Node_ShouldReturnPoint()
        {
            var node = CreateNode(1);
            node.Tags = new TagsCollection(new Tag(NAME, NAME));

            var feature = _converter.ToGeoJson(node);
            var point = feature.Geometry as Point;

            Assert.AreEqual(feature.Attributes[NAME], NAME);
            Assert.IsNotNull(point);
            var position = point.Coordinate;
            Assert.IsNotNull(position);
            Assert.AreEqual(node.Latitude, position.Y);
            Assert.AreEqual(node.Longitude, position.X);
        }

        [TestMethod]
        public void ToGeoJson_WayWithOneNode_ShouldReturnNull()
        {
            var node = CreateNode(1);
            var way = new CompleteWay { Id = 2, Tags = new TagsCollection() };
            way.Nodes = new[] { node };
            way.Tags.Add(NAME, NAME);

            var feature = _converter.ToGeoJson(way);

            Assert.IsNull(feature);
        }


        [TestMethod]
        public void ToGeoJson_Way_ShouldReturnLineString()
        {
            var node1 = CreateNode(1);
            var node2 = CreateNode(2);
            var way = new CompleteWay { Id = 3, Tags = new TagsCollection() };
            way.Nodes = new[] { node1, node2 };
            way.Tags.Add(NAME, NAME);

            var feature = _converter.ToGeoJson(way);
            var lineString = feature.Geometry as LineString;

            Assert.AreEqual(feature.Attributes[NAME], NAME);
            Assert.IsNotNull(lineString);
            Assert.AreEqual(node1.Latitude, lineString.Coordinates.First().Y);
            Assert.AreEqual(node2.Longitude, lineString.Coordinates.Last().X);
        }

        [TestMethod]
        public void ToGeoJson_Way_ShouldReturnPolygon()
        {
            var node1 = CreateNode(1);
            var node2 = CreateNode(2);
            var node3 = CreateNode(3);
            var node4 = CreateNode(1);
            var way = new CompleteWay { Id = 4, Tags = new TagsCollection() };
            way.Nodes = new[] { node1, node2, node3, node4 };
            way.Tags.Add(NAME, NAME);

            var feature = _converter.ToGeoJson(way);
            var polygon = feature.Geometry as Polygon;

            Assert.AreEqual(feature.Attributes[NAME], NAME);
            Assert.IsNotNull(polygon);
            Assert.AreEqual(node1.Latitude, polygon.Coordinates.First().Y);
            Assert.AreEqual(node1.Longitude, polygon.Coordinates.Last().X);
        }

        [TestMethod]
        public void ToGeoJson_RelationWithOuterOnly_ShouldReturnMultiPolygon()
        {
            var node1 = CreateNode(1);
            var node2 = CreateNode(2);
            var node3 = CreateNode(3);
            var node4 = CreateNode(1);
            var way = new CompleteWay { Id = 4 };
            way.Nodes = new[] { node1, node2, node3, node4 };
            var relation = new CompleteRelation { Id = 5, Tags = new TagsCollection() };
            relation.Tags.Add("boundary", "true");
            relation.Members = new[] { new CompleteRelationMember { Member = way, Role = "outer" } };

            var feature = _converter.ToGeoJson(relation);
            var multiPolygon = feature.Geometry as MultiPolygon;

            Assert.IsNotNull(multiPolygon);
            Assert.AreEqual(4, multiPolygon.Coordinates.Length);
            Assert.AreEqual(node1.Latitude, multiPolygon.Coordinates.First().Y);
            Assert.AreEqual(node4.Longitude, multiPolygon.Coordinates.Last().X);
        }

        [TestMethod]
        public void ToGeoJson_RelationWithTwoSubRelationsWithInnerRole_ShouldReturnMultiPolygon()
        {
            var node1 = CreateNode(1);
            var node2 = CreateNode(2);
            var node3 = CreateNode(3);
            var node4 = CreateNode(1);
            var way = new CompleteWay { Id = 4 };
            way.Nodes = new[] { node1, node2, node3, node4 };
            var subRelation1 = new CompleteRelation { Id = 5 };
            subRelation1.Members = new[] { new CompleteRelationMember { Member = way, Role = "outer" } };
            var subRelation2 = new CompleteRelation { Id = 5 };
            subRelation2.Members = new[] { new CompleteRelationMember { Member = way, Role = "outer" } };
            var relation = new CompleteRelation { Id = 5, Tags = new TagsCollection() };
            relation.Tags.Add("type", "multipolygon");
            relation.Members = new[] {
                new CompleteRelationMember { Member = subRelation1 },
                new CompleteRelationMember { Member = subRelation2 }
            };

            var feature = _converter.ToGeoJson(relation);
            var multiPolygon = feature.Geometry as MultiPolygon;

            Assert.IsNotNull(multiPolygon);
            Assert.AreEqual(7, multiPolygon.Coordinates.Length);
            Assert.AreEqual(node1.Latitude, multiPolygon.Coordinates.First().Y);
            Assert.AreEqual(node4.Longitude, multiPolygon.Coordinates.Last().X);
        }

        [TestMethod]
        public void ToGeoJson_RelationWithNodes_ShouldReturnMultiPoint()
        {
            var node1 = CreateNode(1);
            var node2 = CreateNode(2);
            var relation = new CompleteRelation { Id = 3, Tags = new TagsCollection() };
            relation.Tags.Add(NAME, NAME);
            relation.Members = new[] {
                new CompleteRelationMember { Member = node1 },
                new CompleteRelationMember { Member = node2 }
            };

            var feature = _converter.ToGeoJson(relation);
            var multiPoint = feature.Geometry as MultiPoint;

            Assert.IsNotNull(multiPoint);
            Assert.AreEqual(2, multiPoint.Coordinates.Length);
            var position1 = multiPoint.Coordinates.First();
            Assert.IsNotNull(position1);
            Assert.AreEqual(node1.Latitude, position1.Y);
            var position2 = multiPoint.Coordinates.Last();
            Assert.IsNotNull(position2);
            Assert.AreEqual(node2.Longitude, position2.X);
        }

        [TestMethod]
        public void ToGeoJson_RelationWithoutWays_ShouldReturnMultiPoint()
        {
            var relation = new CompleteRelation { Id = 3, Tags = new TagsCollection(), Members = new CompleteRelationMember[0] };
            relation.Tags.Add(NAME, NAME);

            var feature = _converter.ToGeoJson(relation);

            Assert.IsNull(feature);
        }

        [TestMethod]
        public void ToGeoJson_RelationWithPolygonAndLineString_ShouldReturnMultiLineStringAfterGrouping()
        {
            var node1 = CreateNode(1);
            var node2 = CreateNode(2);
            var node3 = CreateNode(3);
            var node4 = CreateNode(4);
            var node5 = CreateNode(5);
            var node6 = CreateNode(6);
            var node7 = CreateNode(7);
            var wayPartOfLineString1 = new CompleteWay { Id = 8 };
            var wayPartOfLineString2 = new CompleteWay { Id = 9 };
            wayPartOfLineString1.Nodes = new[] { node1, node2 };
            wayPartOfLineString2.Nodes = new[] { node2, node3 };
            var wayPartOfPolygon1 = new CompleteWay { Id = 10 };
            var wayPartOfPolygon2 = new CompleteWay { Id = 11 };
            wayPartOfPolygon1.Nodes = new[] { node4, node5, node6 };
            wayPartOfPolygon2.Nodes = new[] { node4, node7, node6 };
            var relation = new CompleteRelation { Id = 12, Tags = new TagsCollection() };
            relation.Tags.Add(NAME, NAME);
            relation.Members = new[] {
                new CompleteRelationMember { Member = wayPartOfLineString1 },
                new CompleteRelationMember { Member = wayPartOfLineString2 },
                new CompleteRelationMember { Member = wayPartOfPolygon1 },
                new CompleteRelationMember { Member = wayPartOfPolygon2 },
            };

            var feature = _converter.ToGeoJson(relation);
            var multiLineString = feature.Geometry as MultiLineString;

            Assert.IsNotNull(multiLineString);
            Assert.AreEqual(2, multiLineString.Geometries.Length);
            var lineString = multiLineString.Geometries.First();
            Assert.AreEqual(3, lineString.Coordinates.Length);
            var polygon = multiLineString.Geometries.Last();
            Assert.AreEqual(5, polygon.Coordinates.Length);
            Assert.AreEqual(polygon.Coordinates.First(), polygon.Coordinates.Last());
        }

        [TestMethod]
        public void ToGeoJson_RelationWithRelation_ShouldReturnMultiLineStringAfterGrouping()
        {
            var node1 = CreateNode(1);
            var node2 = CreateNode(2);
            var node3 = CreateNode(3);
            var node4 = CreateNode(4);
            var node5 = CreateNode(5);
            var node6 = CreateNode(6);
            var node7 = CreateNode(7);

            var wayPartOfLineString1 = new CompleteWay { Id = 8 };
            var wayPartOfLineString2 = new CompleteWay { Id = 9 };

            wayPartOfLineString1.Nodes = new[] { node2, node3 };
            wayPartOfLineString2.Nodes = new[] { node1, node2 };

            var wayPartOfPolygon1 = new CompleteWay { Id = 10 };
            var wayPartOfPolygon2 = new CompleteWay { Id = 11 };

            wayPartOfPolygon1.Nodes = new[] { node4, node5, node6 };
            wayPartOfPolygon2.Nodes = new[] { node4, node7, node6 };

            var subRelation = new CompleteRelation { Id = 12 };
            subRelation.Members = new[] {
                new CompleteRelationMember { Member = wayPartOfLineString1 },
                new CompleteRelationMember { Member = wayPartOfLineString2 }
            };
            var relation = new CompleteRelation { Id = 13, Tags = new TagsCollection() };
            relation.Tags.Add(NAME, NAME);
            relation.Members = new[] {
                new CompleteRelationMember { Member = subRelation },
                new CompleteRelationMember { Member = wayPartOfPolygon1 },
                new CompleteRelationMember { Member = wayPartOfPolygon2 }
            };


            var feature = _converter.ToGeoJson(relation);
            var multiLineString = feature.Geometry as MultiLineString;

            Assert.IsNotNull(multiLineString);
            Assert.AreEqual(8, multiLineString.Coordinates.Length);
            var lineString = multiLineString.Geometries.First();
            Assert.AreEqual(3, lineString.Coordinates.Length);
            var polygon = multiLineString.Geometries.Last();
            Assert.AreEqual(5, polygon.Coordinates.Length);
            Assert.AreEqual(polygon.Coordinates.First(), polygon.Coordinates.Last());
        }


        [TestMethod]
        public void ToGeoJson_MultiPolygonWithHole_ShouldReturnMultiPlygonWithSinglePolygon()
        {
            var node1 = CreateNode(1, 0, 0);
            var node2 = CreateNode(2, 1, 0);
            var node3 = CreateNode(3, 1, 1);
            var node4 = CreateNode(4, 0, 1);
            var node5 = CreateNode(5, 0.5, 0.5);
            var node6 = CreateNode(6, 0.5, 0.6);
            var node7 = CreateNode(7, 0.6, 0.6);
            var node8 = CreateNode(8, 0.6, 0.5);
            var wayOuter = new CompleteWay { Id = 9 };
            wayOuter.Nodes = new[] { node1, node2, node3, node4, node1 };
            var wayInner = new CompleteWay { Id = 9 };
            wayInner.Nodes = new[] { node5, node6, node7, node8, node5 };
            var relation = new CompleteRelation { Id = 10, Tags = new TagsCollection() };
            relation.Members = new[] {
                new CompleteRelationMember { Member = wayInner, Role = "inner" },
                new CompleteRelationMember { Member = wayOuter, Role = "outer" }
            };
            relation.Tags.Add("boundary", "true");

            var geoJson = _converter.ToGeoJson(relation);

            var multiPlygon = geoJson.Geometry as MultiPolygon;
            Assert.IsNotNull(multiPlygon);
            Assert.IsTrue(multiPlygon.IsValid);
            Assert.AreEqual(1, multiPlygon.Geometries.Length);
        }

        [TestMethod]
        public void ToGeoJson_UnsortedRelation_ShouldReturnMultiLineStringAfterGrouping()
        {
            var node1 = CreateNode(1);
            var node2 = CreateNode(2);
            var node3 = CreateNode(3);
            var node4 = CreateNode(4);
            var wayPartOfLineString1 = new CompleteWay { Id = 8 };
            var wayPartOfLineString2 = new CompleteWay { Id = 9 };
            var wayPartOfLineString3 = new CompleteWay { Id = 10 };
            wayPartOfLineString1.Nodes = new[] { node1, node2 };
            wayPartOfLineString2.Nodes = new[] { node3, node4 };
            wayPartOfLineString3.Nodes = new[] { node3, node2 };
            var relation = new CompleteRelation { Id = 11, Tags = new TagsCollection() };
            relation.Tags.Add(NAME, NAME);
            relation.Members = new[] {
                new CompleteRelationMember { Member = wayPartOfLineString1 },
                new CompleteRelationMember { Member = wayPartOfLineString2 },
                new CompleteRelationMember { Member = wayPartOfLineString3 }
            };

            var feature = _converter.ToGeoJson(relation);
            var multiLineString = feature.Geometry as MultiLineString;

            Assert.IsNotNull(multiLineString);
            Assert.AreEqual(1, multiLineString.Geometries.Length);
            var lineString = multiLineString.Geometries.First();
            Assert.AreEqual(4, lineString.Coordinates.Length);
        }
    }
}
