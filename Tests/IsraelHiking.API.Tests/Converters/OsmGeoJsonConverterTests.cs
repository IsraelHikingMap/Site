using System;
using System.Linq;
using IsraelHiking.API.Converters;
using Microsoft.VisualStudio.TestTools.UnitTesting;
using NetTopologySuite.Geometries;
using NetTopologySuite.Operation.Valid;
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
            _converter = new OsmGeoJsonConverter(new GeometryFactory());
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
            node.UserName = "UserName";
            node.TimeStamp = DateTime.Now;
            node.Latitude = 10.1234567890;
            node.Longitude = 11.234567890;
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
            var way = new CompleteWay
            {
                Id = 2,
                Tags = new TagsCollection(),
                Nodes = new[] {node},
                UserName = "UserName",
                TimeStamp = DateTime.Now
            };
            way.Tags.Add(NAME, NAME);

            var feature = _converter.ToGeoJson(way);

            Assert.IsNull(feature);
        }


        [TestMethod]
        public void ToGeoJson_Way_ShouldReturnLineString()
        {
            var node1 = CreateNode(1);
            var node2 = CreateNode(2);
            var way = new CompleteWay
            {
                Id = 3,
                Tags = new TagsCollection(),
                Nodes = new[] {node1, node2}
            };
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
            var way = new CompleteWay
            {
                Id = 4,
                Tags = new TagsCollection(),
                Nodes = new[] {node1, node2, node3, node4}
            };
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
            var way = new CompleteWay
            {
                Id = 4,
                Nodes = new[] {node1, node2, node3, node4}
            };
            var relation = new CompleteRelation { Id = 5, Tags = new TagsCollection() };
            relation.Tags.Add("type", "boundary");
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
            int id = 1;
            var node1 = CreateNode(id++, 1, 1);
            var node2 = CreateNode(id++, 2, 2);
            var node3 = CreateNode(id++, 1, 2);
           
            var way1 = new CompleteWay
            {
                Id = 4,
                Nodes = new[] {node1, node2, node3, node1}
            };
            var node4 = CreateNode(id++, 4, 4);
            var node5 = CreateNode(id++, 5, 5);
            var node6 = CreateNode(id++, 4, 5);
            var way2 = new CompleteWay
            {
                Id = id++,
                Nodes = new[] { node4, node5, node6, node4 }
            };
            var subRelation1 = new CompleteRelation
            {
                Id = id++,
                Members = new[] {new CompleteRelationMember {Member = way1, Role = "outer"}}
            };
            var subRelation2 = new CompleteRelation
            {
                Id = id++,
                Members = new[] {new CompleteRelationMember {Member = way2, Role = "outer"}}
            };
            var relation = new CompleteRelation { Id = id++, Tags = new TagsCollection() };
            relation.Tags.Add("type", "multipolygon");
            relation.Members = new[] {
                new CompleteRelationMember { Member = subRelation1 },
                new CompleteRelationMember { Member = subRelation2 }
            };

            var feature = _converter.ToGeoJson(relation);
            var multiPolygon = feature.Geometry as MultiPolygon;

            Assert.IsNotNull(multiPolygon);
            Assert.AreEqual(8, multiPolygon.Coordinates.Length);
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
        public void ToGeoJson_RelationWithoutMembers_ShouldReturnNull()
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
            var lineString2 = multiLineString.Geometries.Last();
            Assert.AreEqual(5, lineString2.Coordinates.Length);
            Assert.AreEqual(lineString2.Coordinates.First(), lineString2.Coordinates.Last());
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

            var subRelation = new CompleteRelation
            {
                Id = 12,
                Members = new[]
                {
                    new CompleteRelationMember {Member = wayPartOfLineString1},
                    new CompleteRelationMember {Member = wayPartOfLineString2}
                }
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
            var lineString2 = multiLineString.Geometries.Last();
            Assert.AreEqual(5, lineString2.Coordinates.Length);
            Assert.AreEqual(lineString2.Coordinates.First(), lineString2.Coordinates.Last());

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
            var wayOuter = new CompleteWay
            {
                Id = 9,
                Nodes = new[] {node1, node2, node3, node4, node1}
            };
            var wayInner = new CompleteWay
            {
                Id = 9,
                Nodes = new[] {node5, node6, node7, node8, node5}
            };
            var relation = new CompleteRelation
            {
                Id = 10,
                Tags = new TagsCollection(),
                Members = new[]
                {
                    new CompleteRelationMember {Member = wayInner, Role = "inner"},
                    new CompleteRelationMember {Member = wayOuter, Role = "outer"}
                }
            };
            relation.Tags.Add("type", "boundary");

            var geoJson = _converter.ToGeoJson(relation);

            var multiPlygon = geoJson.Geometry as MultiPolygon;
            Assert.IsNotNull(multiPlygon);
            Assert.IsTrue(multiPlygon.IsValid);
            Assert.AreEqual(1, multiPlygon.Geometries.Length);
        }

        [TestMethod]
        public void ToGeoJson_MultiPolygonWithTwoHoles_ShouldReturnMultiPlygonWithSinglePolygon()
        {
            var id = 1;
            var node1 = CreateNode(id++, 0, 0);
            var node2 = CreateNode(id++, 1, 0);
            var node3 = CreateNode(id++, 1, 1);
            var node4 = CreateNode(id++, 0, 1);
            var node5 = CreateNode(id++, 0.5, 0.5);
            var node6 = CreateNode(id++, 0.5, 0.6);
            var node7 = CreateNode(id++, 0.6, 0.6);
            var node8 = CreateNode(id++, 0.6, 0.5);
            var node9 = CreateNode(id++, 0.3, 0.3);
            var node10 = CreateNode(id++, 0.3, 0.4);
            var node11 = CreateNode(id++, 0.4, 0.4);
            var node12 = CreateNode(id++, 0.4, 0.3);

            var wayOuter = new CompleteWay
            {
                Id = id++,
                Nodes = new[] { node1, node2, node3, node4, node1 }
            };
            var wayInner1 = new CompleteWay
            {
                Id = id++,
                Nodes = new[] { node5, node6, node7, node8, node5 }
            };
            var wayInner2 = new CompleteWay
            {
                Id = id++,
                Nodes = new[] { node9, node10, node11, node12, node9 }
            };
            var relation = new CompleteRelation
            {
                Id = id++,
                Tags = new TagsCollection(),
                Members = new[]
                {
                    new CompleteRelationMember {Member = wayInner1, Role = "inner"},
                    new CompleteRelationMember {Member = wayInner2, Role = "inner"},
                    new CompleteRelationMember {Member = wayOuter, Role = "outer"}
                }
            };
            relation.Tags.Add("type", "boundary");

            var geoJson = _converter.ToGeoJson(relation);

            var multiPlygon = geoJson.Geometry as MultiPolygon;
            Assert.IsNotNull(multiPlygon);
            Assert.IsTrue(multiPlygon.IsValid);
            Assert.AreEqual(1, multiPlygon.Geometries.Length);
        }

        [TestMethod]
        public void ToGeoJson_MultiPolygonWithTwoTouchingHoles_ShouldReturnMultiPlygonWithSinglePolygon()
        {
            var id = 1;
            var node1 = CreateNode(id++, 0, 0);
            var node2 = CreateNode(id++, 1, 0);
            var node3 = CreateNode(id++, 1, 1);
            var node4 = CreateNode(id++, 0, 1);
            var node5 = CreateNode(id++, 0.5, 0.5);
            var node6 = CreateNode(id++, 0.5, 0.6);
            var node7 = CreateNode(id++, 0.6, 0.6);
            var node8 = CreateNode(id++, 0.6, 0.5);
            var node9 = CreateNode(id++, 0.4, 0.6);
            var node10 = CreateNode(id++, 0.4, 0.5);

            var wayOuter = new CompleteWay
            {
                Id = id++,
                Nodes = new[] { node1, node2, node3, node4, node1 }
            };
            var wayInner1 = new CompleteWay
            {
                Id = id++,
                Nodes = new[] { node5, node6, node7, node8, node5 }
            };
            var wayInner2 = new CompleteWay
            {
                Id = id++,
                Nodes = new[] { node5, node6, node9, node10, node5 }
            };
            var relation = new CompleteRelation
            {
                Id = id++,
                Tags = new TagsCollection(),
                Members = new[]
                {
                    new CompleteRelationMember {Member = wayInner1, Role = "inner"},
                    new CompleteRelationMember {Member = wayInner2, Role = "inner"},
                    new CompleteRelationMember {Member = wayOuter, Role = "outer"}
                }
            };
            relation.Tags.Add("type", "boundary");

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

        [TestMethod]
        public void ToGeoJson_UnsortedRelationWithDirection_ShouldReturnMultiLineStringAfterGrouping()
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
            wayPartOfLineString3.Tags = new TagsCollection() { { "oneway", "yes" } };
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
            Assert.AreEqual(node4.Longitude, lineString.Coordinates.First().X);
        }

        [TestMethod]
        public void ToGeoJson_RelationWithTouchingPolygones_ShouldReturnValidMultiPolygon()
        {
            int id = 1;
            var node1 = CreateNode(id++, 0, 0);
            var node2 = CreateNode(id++, 0, 1);
            var node3 = CreateNode(id++, 1, 1);
            var node4 = CreateNode(id++, 1, 0);
            var node5 = CreateNode(id++, 0, 2);
            var node6 = CreateNode(id++, 1, 2);
            var node7 = CreateNode(id++, -1, -1);
            var node8 = CreateNode(id++, 3, -1);
            var node9 = CreateNode(id++, 3, 3);
            var node10 = CreateNode(id++, -1, 3);
            var polygon1inner = new CompleteWay { Id = id++, Nodes = new[] { node1, node2, node3, node4, node1 } };
            var polygon2inner = new CompleteWay { Id = id++, Nodes = new[] { node2, node5, node6, node3, node2 } };
            var polygonOuter = new CompleteWay { Id = id++, Nodes = new[] { node7, node8, node9, node10, node7 } };

            var relation = new CompleteRelation { Id = id++, Tags = new TagsCollection() };
            relation.Tags.Add(NAME, NAME);
            relation.Tags.Add("type", "multipolygon");
            relation.Members = new[] {
                new CompleteRelationMember { Member = polygonOuter, Role = "outer" },
                new CompleteRelationMember { Member = polygon1inner },
                new CompleteRelationMember { Member = polygon2inner }
            };

            var feature = _converter.ToGeoJson(relation);
            var multiPolygon = feature.Geometry as MultiPolygon;

            Assert.IsNotNull(multiPolygon);
            var isValidOp = new IsValidOp(multiPolygon);
            Assert.IsTrue(isValidOp.IsValid);
        }

        [TestMethod]
        public void ToGeoJson_Convert8Shape_ShouldConvertToMultipolygon()
        {
            int id = 1;
            var node1 = CreateNode(id++, 0, 0);
            var node2 = CreateNode(id++, 0, 1);
            var node3 = CreateNode(id++, 1, 1);

            var node4 = CreateNode(id++, 1, 0);
            var node5 = CreateNode(id++, 0, -1);
            var node6 = CreateNode(id++, -1, -1);

            var node7 = CreateNode(id++, -1, 0);
            var way1 = new CompleteWay { Id = id++, Nodes = new[] { node1, node2, node3 } };
            var way2 = new CompleteWay { Id = id++, Nodes = new[] { node3, node4, node1, node5, node6 } };
            var way3 = new CompleteWay { Id = id++, Nodes = new[] { node6, node7, node1 } };

            var relation = new CompleteRelation { Id = id++, Tags = new TagsCollection() };
            relation.Tags.Add(NAME, NAME);
            relation.Tags.Add("type", "multipolygon");
            relation.Members = new[] {
                new CompleteRelationMember { Member = way1, Role = "outer" },
                new CompleteRelationMember { Member = way2, Role = "outer" },
                new CompleteRelationMember { Member = way3, Role = "outer" }
            };

            var feature = _converter.ToGeoJson(relation);
            var multiPolygon = feature.Geometry as MultiPolygon;

            Assert.IsNotNull(multiPolygon);
            var isValidOp = new IsValidOp(multiPolygon);
            Assert.IsTrue(isValidOp.IsValid);
        }

        [TestMethod]
        public void ToGeoJson_ConvertLoopAndLines_ShouldCreateValidMultiLine()
        {
            int id = 1;
            var node1 = CreateNode(id++, 0, 0);
            var node2 = CreateNode(id++, 0, 1);
            var node3 = CreateNode(id++, 1, 1);
            var node4 = CreateNode(id++, 1, 0);

            var node5 = CreateNode(id++, 0, -1);

            var way1 = new CompleteWay { Id = id++, Nodes = new[] { node1, node5 } };
            var way2 = new CompleteWay { Id = id++, Nodes = new[] { node1, node2, node3, node4, node1 } };

            var relation = new CompleteRelation { Id = id++, Tags = new TagsCollection() };
            relation.Tags.Add(NAME, NAME);
            relation.Members = new[] {
                new CompleteRelationMember { Member = way1, Role = "outer" },
                new CompleteRelationMember { Member = way2, Role = "outer" }            
            };

            var feature = _converter.ToGeoJson(relation);
            var multiLineString = feature.Geometry as MultiLineString;

            Assert.IsNotNull(multiLineString);
            var isValidOp = new IsValidOp(multiLineString);
            Assert.IsTrue(isValidOp.IsValid);
        }
    }
}
