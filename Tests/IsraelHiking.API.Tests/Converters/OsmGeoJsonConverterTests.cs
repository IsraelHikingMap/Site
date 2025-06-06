﻿using System;
using System.Linq;
using IsraelHiking.API.Converters;
using Microsoft.VisualStudio.TestTools.UnitTesting;
using NetTopologySuite.Geometries;
using NetTopologySuite.Operation.Valid;
using OsmSharp;
using OsmSharp.Tags;
using OsmSharp.Complete;

namespace IsraelHiking.API.Tests.Converters;

[TestClass]
public class OsmGeoJsonConverterTests
{
    private const string NAME = "name";
    private OsmGeoJsonConverter _converter;

    private static Node CreateNode(int number)
    {
        return new Node
        {
            Longitude = number,
            Latitude = number,
            Id = number
        };
    }

    private Node CreateNode(int number, double latitude, double longitude)
    {
        return new Node
        {
            Longitude = longitude,
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
            Nodes = [node],
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
            Nodes = [node1, node2]
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
            Nodes = [node1, node2, node3, node4]
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
            Nodes = [node1, node2, node3, node4]
        };
        var relation = new CompleteRelation { Id = 5, Tags = new TagsCollection() };
        relation.Tags.Add("type", "boundary");
        relation.Members = [new CompleteRelationMember { Member = way, Role = "outer" }];

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
        var id = 0;
        var node1 = CreateNode(++id, 1, 1);
        var node2 = CreateNode(++id, 2, 2);
        var node3 = CreateNode(++id, 1, 2);
           
        var way1 = new CompleteWay
        {
            Id = 4,
            Nodes = [node1, node2, node3, node1]
        };
        var node4 = CreateNode(++id, 4, 4);
        var node5 = CreateNode(++id, 5, 5);
        var node6 = CreateNode(++id, 4, 5);
        var way2 = new CompleteWay
        {
            Id = ++id,
            Nodes = [node4, node5, node6, node4]
        };
        var subRelation1 = new CompleteRelation
        {
            Id = ++id,
            Members = [new CompleteRelationMember {Member = way1, Role = "outer"}]
        };
        var subRelation2 = new CompleteRelation
        {
            Id = ++id,
            Members = [new CompleteRelationMember {Member = way2, Role = "outer"}]
        };
        var relation = new CompleteRelation { Id = ++id, Tags = new TagsCollection() };
        relation.Tags.Add("type", "multipolygon");
        relation.Members =
        [
            new CompleteRelationMember { Member = subRelation1 },
            new CompleteRelationMember { Member = subRelation2 }
        ];

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
        relation.Members =
        [
            new CompleteRelationMember { Member = node1 },
            new CompleteRelationMember { Member = node2 }
        ];

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
        var relation = new CompleteRelation { Id = 3, Tags = new TagsCollection(), Members = [] };
        relation.Tags.Add(NAME, NAME);

        var feature = _converter.ToGeoJson(relation);

        Assert.IsNull(feature);
    }

    [TestMethod]
    public void ToGeoJson_RelationWithPolygonAndLineString_ShouldReturnMultiLineStringAfterGrouping()
    {
        var id = 0;
        var node1 = CreateNode(++id);
        var node2 = CreateNode(++id);
        var node3 = CreateNode(++id);
        var node4 = CreateNode(++id);
        var node5 = CreateNode(++id);
        var node6 = CreateNode(++id);
        var node7 = CreateNode(++id);
        var wayPartOfLineString1 = new CompleteWay { Id = ++id };
        var wayPartOfLineString2 = new CompleteWay { Id = ++id };
        wayPartOfLineString1.Nodes = [node1, node2];
        wayPartOfLineString2.Nodes = [node2, node3];
        var wayPartOfPolygon1 = new CompleteWay { Id = ++id };
        var wayPartOfPolygon2 = new CompleteWay { Id = ++id };
        wayPartOfPolygon1.Nodes = [node4, node5, node6];
        wayPartOfPolygon2.Nodes = [node4, node7, node6];
        var relation = new CompleteRelation { Id = ++id, Tags = new TagsCollection() };
        relation.Tags.Add(NAME, NAME);
        relation.Members =
        [
            new CompleteRelationMember { Member = wayPartOfLineString1 },
            new CompleteRelationMember { Member = wayPartOfLineString2 },
            new CompleteRelationMember { Member = wayPartOfPolygon1 },
            new CompleteRelationMember { Member = wayPartOfPolygon2 }
        ];

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
        var id = 0;
        var node1 = CreateNode(++id);
        var node2 = CreateNode(++id);
        var node3 = CreateNode(++id);
        var node4 = CreateNode(++id);
        var node5 = CreateNode(++id);
        var node6 = CreateNode(++id);
        var node7 = CreateNode(++id);

        var wayPartOfLineString1 = new CompleteWay { Id = ++id };
        var wayPartOfLineString2 = new CompleteWay { Id = ++id };

        wayPartOfLineString1.Nodes = [node2, node3];
        wayPartOfLineString2.Nodes = [node1, node2];

        var wayPartOfPolygon1 = new CompleteWay { Id = ++id };
        var wayPartOfPolygon2 = new CompleteWay { Id = ++id };

        wayPartOfPolygon1.Nodes = [node4, node5, node6];
        wayPartOfPolygon2.Nodes = [node4, node7, node6];

        var subRelation = new CompleteRelation
        {
            Id = ++id,
            Members =
            [
                new CompleteRelationMember {Member = wayPartOfLineString1},
                new CompleteRelationMember {Member = wayPartOfLineString2}
            ]
        };
        var relation = new CompleteRelation { Id = ++id, Tags = new TagsCollection() };
        relation.Tags.Add(NAME, NAME);
        relation.Members =
        [
            new CompleteRelationMember { Member = subRelation },
            new CompleteRelationMember { Member = wayPartOfPolygon1 },
            new CompleteRelationMember { Member = wayPartOfPolygon2 }
        ];


        var feature = _converter.ToGeoJson(relation);
        var multiLineString = feature.Geometry as MultiLineString;

        Assert.IsNotNull(multiLineString);
        Assert.AreEqual(8, multiLineString.Coordinates.Length);
        var lineString = multiLineString.Geometries.First();
        Assert.AreEqual(5, lineString.Coordinates.Length);
        var lineString2 = multiLineString.Geometries.Last();
        Assert.AreEqual(3, lineString2.Coordinates.Length);
        Assert.AreEqual(lineString.Coordinates.First(), lineString.Coordinates.Last());

    }


    [TestMethod]
    public void ToGeoJson_MultiPolygonWithHole_ShouldReturnMultiPolygonWithSinglePolygon()
    {
        var id = 0;
        var node1 = CreateNode(++id, 0, 0);
        var node2 = CreateNode(++id, 1, 0);
        var node3 = CreateNode(++id, 1, 1);
        var node4 = CreateNode(++id, 0, 1);
        var node5 = CreateNode(++id, 0.5, 0.5);
        var node6 = CreateNode(++id, 0.5, 0.6);
        var node7 = CreateNode(++id, 0.6, 0.6);
        var node8 = CreateNode(++id, 0.6, 0.5);
        var wayOuter = new CompleteWay
        {
            Id = ++id,
            Nodes = [node1, node2, node3, node4, node1]
        };
        var wayInner = new CompleteWay
        {
            Id = ++id,
            Nodes = [node5, node6, node7, node8, node5]
        };
        var relation = new CompleteRelation
        {
            Id = ++id,
            Tags = new TagsCollection(),
            Members =
            [
                new CompleteRelationMember {Member = wayInner, Role = "inner"},
                new CompleteRelationMember {Member = wayOuter, Role = "outer"}
            ]
        };
        relation.Tags.Add("type", "boundary");

        var geoJson = _converter.ToGeoJson(relation);

        var multiPolygon = geoJson.Geometry as MultiPolygon;
        Assert.IsNotNull(multiPolygon);
        Assert.IsTrue(multiPolygon.IsValid);
        Assert.AreEqual(1, multiPolygon.Geometries.Length);
    }

    [TestMethod]
    public void ToGeoJson_MultiPolygonWithTwoHoles_ShouldReturnMultiPolygonWithSinglePolygon()
    {
        var id = 0;
        var node1 = CreateNode(++id, 0, 0);
        var node2 = CreateNode(++id, 1, 0);
        var node3 = CreateNode(++id, 1, 1);
        var node4 = CreateNode(++id, 0, 1);
        var node5 = CreateNode(++id, 0.5, 0.5);
        var node6 = CreateNode(++id, 0.5, 0.6);
        var node7 = CreateNode(++id, 0.6, 0.6);
        var node8 = CreateNode(++id, 0.6, 0.5);
        var node9 = CreateNode(++id, 0.3, 0.3);
        var node10 = CreateNode(++id, 0.3, 0.4);
        var node11 = CreateNode(++id, 0.4, 0.4);
        var node12 = CreateNode(++id, 0.4, 0.3);

        var wayOuter = new CompleteWay
        {
            Id = ++id,
            Nodes = [node1, node2, node3, node4, node1]
        };
        var wayInner1 = new CompleteWay
        {
            Id = ++id,
            Nodes = [node5, node6, node7, node8, node5]
        };
        var wayInner2 = new CompleteWay
        {
            Id = ++id,
            Nodes = [node9, node10, node11, node12, node9]
        };
        var relation = new CompleteRelation
        {
            Id = ++id,
            Tags = new TagsCollection(),
            Members =
            [
                new CompleteRelationMember {Member = wayInner1, Role = "inner"},
                new CompleteRelationMember {Member = wayInner2, Role = "inner"},
                new CompleteRelationMember {Member = wayOuter, Role = "outer"}
            ]
        };
        relation.Tags.Add("type", "boundary");

        var geoJson = _converter.ToGeoJson(relation);

        var multiPolygon = geoJson.Geometry as MultiPolygon;
        Assert.IsNotNull(multiPolygon);
        Assert.IsTrue(multiPolygon.IsValid);
        Assert.AreEqual(1, multiPolygon.Geometries.Length);
    }

    [TestMethod]
    public void ToGeoJson_MultiPolygonWithTwoTouchingHoles_ShouldReturnMultiPolygonWithSinglePolygon()
    {
        var id = 0;
        var node1 = CreateNode(++id, 0, 0);
        var node2 = CreateNode(++id, 1, 0);
        var node3 = CreateNode(++id, 1, 1);
        var node4 = CreateNode(++id, 0, 1);
        var node5 = CreateNode(++id, 0.5, 0.5);
        var node6 = CreateNode(++id, 0.5, 0.6);
        var node7 = CreateNode(++id, 0.6, 0.6);
        var node8 = CreateNode(++id, 0.6, 0.5);
        var node9 = CreateNode(++id, 0.4, 0.6);
        var node10 = CreateNode(++id, 0.4, 0.5);

        var wayOuter = new CompleteWay
        {
            Id = ++id,
            Nodes = [node1, node2, node3, node4, node1]
        };
        var wayInner1 = new CompleteWay
        {
            Id = ++id,
            Nodes = [node5, node6, node7, node8, node5]
        };
        var wayInner2 = new CompleteWay
        {
            Id = ++id,
            Nodes = [node5, node6, node9, node10, node5]
        };
        var relation = new CompleteRelation
        {
            Id = ++id,
            Tags = new TagsCollection(),
            Members =
            [
                new CompleteRelationMember {Member = wayInner1, Role = "inner"},
                new CompleteRelationMember {Member = wayInner2, Role = "inner"},
                new CompleteRelationMember {Member = wayOuter, Role = "outer"}
            ]
        };
        relation.Tags.Add("type", "boundary");

        var geoJson = _converter.ToGeoJson(relation);

        var multiPolygon = geoJson.Geometry as MultiPolygon;
        Assert.IsNotNull(multiPolygon);
        Assert.IsTrue(multiPolygon.IsValid);
        Assert.AreEqual(1, multiPolygon.Geometries.Length);
    }


    [TestMethod]
    public void ToGeoJson_UnsortedRelation_ShouldReturnMultiLineStringAfterGrouping()
    {
        var id = 0;
        var node1 = CreateNode(++id);
        var node2 = CreateNode(++id);
        var node3 = CreateNode(++id);
        var node4 = CreateNode(++id);
        var wayPartOfLineString1 = new CompleteWay { Id = ++id };
        var wayPartOfLineString2 = new CompleteWay { Id = ++id };
        var wayPartOfLineString3 = new CompleteWay { Id = ++id };
        wayPartOfLineString1.Nodes = [node1, node2];
        wayPartOfLineString2.Nodes = [node3, node4];
        wayPartOfLineString3.Nodes = [node3, node2];
        var relation = new CompleteRelation { Id = ++id, Tags = new TagsCollection() };
        relation.Tags.Add(NAME, NAME);
        relation.Members =
        [
            new CompleteRelationMember { Member = wayPartOfLineString1 },
            new CompleteRelationMember { Member = wayPartOfLineString2 },
            new CompleteRelationMember { Member = wayPartOfLineString3 }
        ];

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
        var id = 0;
        var node1 = CreateNode(++id);
        var node2 = CreateNode(++id);
        var node3 = CreateNode(++id);
        var node4 = CreateNode(++id);
        var wayPartOfLineString1 = new CompleteWay { Id = ++id };
        var wayPartOfLineString2 = new CompleteWay { Id = ++id };
        var wayPartOfLineString3 = new CompleteWay { Id = ++id };
        wayPartOfLineString1.Nodes = [node1, node2];
        wayPartOfLineString2.Nodes = [node3, node4];
        wayPartOfLineString3.Nodes = [node3, node2];
        wayPartOfLineString3.Tags = new TagsCollection() { { "oneway", "yes" } };
        var relation = new CompleteRelation { Id = ++id, Tags = new TagsCollection() };
        relation.Tags.Add(NAME, NAME);
        relation.Members =
        [
            new CompleteRelationMember { Member = wayPartOfLineString1 },
            new CompleteRelationMember { Member = wayPartOfLineString2 },
            new CompleteRelationMember { Member = wayPartOfLineString3 }
        ];

        var feature = _converter.ToGeoJson(relation);
        var multiLineString = feature.Geometry as MultiLineString;

        Assert.IsNotNull(multiLineString);
        Assert.AreEqual(1, multiLineString.Geometries.Length);
        var lineString = multiLineString.Geometries.First();
        Assert.AreEqual(4, lineString.Coordinates.Length);
        Assert.AreEqual(node4.Longitude, lineString.Coordinates.First().X);
    }

    [TestMethod]
    public void ToGeoJson_RelationWithTouchingPolygons_ShouldReturnValidMultiPolygon()
    {
        var id = 0;
        var node1 = CreateNode(++id, 0, 0);
        var node2 = CreateNode(++id, 0, 1);
        var node3 = CreateNode(++id, 1, 1);
        var node4 = CreateNode(++id, 1, 0);
        var node5 = CreateNode(++id, 0, 2);
        var node6 = CreateNode(++id, 1, 2);
        var node7 = CreateNode(++id, -1, -1);
        var node8 = CreateNode(++id, 3, -1);
        var node9 = CreateNode(++id, 3, 3);
        var node10 = CreateNode(++id, -1, 3);
        var polygon1Inner = new CompleteWay { Id = ++id, Nodes = [node1, node2, node3, node4, node1] };
        var polygon2Inner = new CompleteWay { Id = ++id, Nodes = [node2, node5, node6, node3, node2] };
        var polygonOuter = new CompleteWay { Id = ++id, Nodes = [node7, node8, node9, node10, node7] };

        var relation = new CompleteRelation { Id = ++id, Tags = new TagsCollection() };
        relation.Tags.Add(NAME, NAME);
        relation.Tags.Add("type", "multipolygon");
        relation.Members =
        [
            new CompleteRelationMember { Member = polygonOuter, Role = "outer" },
            new CompleteRelationMember { Member = polygon1Inner },
            new CompleteRelationMember { Member = polygon2Inner }
        ];

        var feature = _converter.ToGeoJson(relation);
        var multiPolygon = feature.Geometry as MultiPolygon;

        Assert.IsNotNull(multiPolygon);
        var isValidOp = new IsValidOp(multiPolygon);
        Assert.IsTrue(isValidOp.IsValid);
    }

    [TestMethod]
    public void ToGeoJson_Convert8Shape_ShouldConvertToMultipolygon()
    {
        var id = 0;
        var node1 = CreateNode(++id, 0, 0);
        var node2 = CreateNode(++id, 0, 1);
        var node3 = CreateNode(++id, 1, 1);

        var node4 = CreateNode(++id, 1, 0);
        var node5 = CreateNode(++id, 0, -1);
        var node6 = CreateNode(++id, -1, -1);

        var node7 = CreateNode(++id, -1, 0);
        var way1 = new CompleteWay { Id = ++id, Nodes = [node1, node2, node3] };
        var way2 = new CompleteWay { Id = ++id, Nodes = [node3, node4, node1, node5, node6] };
        var way3 = new CompleteWay { Id = ++id, Nodes = [node6, node7, node1] };

        var relation = new CompleteRelation { Id = ++id, Tags = new TagsCollection() };
        relation.Tags.Add(NAME, NAME);
        relation.Tags.Add("type", "multipolygon");
        relation.Members =
        [
            new CompleteRelationMember { Member = way1, Role = "outer" },
            new CompleteRelationMember { Member = way2, Role = "outer" },
            new CompleteRelationMember { Member = way3, Role = "outer" }
        ];

        var feature = _converter.ToGeoJson(relation);
        var multiPolygon = feature.Geometry as MultiPolygon;

        Assert.IsNotNull(multiPolygon);
        var isValidOp = new IsValidOp(multiPolygon);
        Assert.IsTrue(isValidOp.IsValid);
    }

    [TestMethod]
    public void ToGeoJson_ConvertLoopAndLines_ShouldCreateValidMultiLine()
    {
        var id = 0;
        var node1 = CreateNode(++id, 0, 0);
        var node2 = CreateNode(++id, 0, 1);
        var node3 = CreateNode(++id, 1, 1);
        var node4 = CreateNode(++id, 1, 0);

        var node5 = CreateNode(++id, 0, -1);

        var way1 = new CompleteWay { Id = ++id, Nodes = [node1, node5] };
        var way2 = new CompleteWay { Id = ++id, Nodes = [node1, node2, node3, node4, node1] };

        var relation = new CompleteRelation { Id = ++id, Tags = new TagsCollection() };
        relation.Tags.Add(NAME, NAME);
        relation.Members =
        [
            new CompleteRelationMember { Member = way1, Role = "outer" },
            new CompleteRelationMember { Member = way2, Role = "outer" }
        ];

        var feature = _converter.ToGeoJson(relation);
        var multiLineString = feature.Geometry as MultiLineString;

        Assert.IsNotNull(multiLineString);
        var isValidOp = new IsValidOp(multiLineString);
        Assert.IsTrue(isValidOp.IsValid);
    }
        
    [TestMethod]
    public void ToGeoJson_ConvertQRoute_ShouldCreateValidMultiLine()
    {
        var id = 0;
        var node1 = CreateNode(++id);
        var node2 = CreateNode(++id);
        var node3 = CreateNode(++id);
        var node4 = CreateNode(++id);
        var node5 = CreateNode(++id);

        var way1 = new CompleteWay { Id = ++id, Nodes = [node1, node5] };
        var way2 = new CompleteWay { Id = ++id, Nodes = [node1, node2, node3, node4, node1] };

        var relation = new CompleteRelation { Id = ++id, Tags = new TagsCollection() };
        relation.Tags.Add(NAME, NAME);
        relation.Members =
        [
            new CompleteRelationMember { Member = way1, Role = "outer" },
            new CompleteRelationMember { Member = way2, Role = "outer" }
        ];

        var feature = _converter.ToGeoJson(relation);
        var multiLineString = feature.Geometry as MultiLineString;

        Assert.IsNotNull(multiLineString);
        var isValidOp = new IsValidOp(multiLineString);
        Assert.IsTrue(isValidOp.IsValid);
        Assert.AreEqual(1, multiLineString.Geometries.Length);
    }
        
    [TestMethod]
    public void ToGeoJson_ConvertUnsortedQRoute_ShouldCreateMultiLineWithSingleLine()
    {
        var id = 0;
        var node1 = CreateNode(++id);
        var node2 = CreateNode(++id);
        var node3 = CreateNode(++id);
        var node4 = CreateNode(++id);
        var node5 = CreateNode(++id);

        var way1 = new CompleteWay { Id = ++id, Nodes = [node1, node2, node3] };
        var way2 = new CompleteWay { Id = ++id, Nodes = [node3, node4, node1] };
        var way3 = new CompleteWay { Id = ++id, Nodes = [node3, node5] };

        var relation = new CompleteRelation { Id = ++id, Tags = new TagsCollection() };
        relation.Tags.Add(NAME, NAME);
        relation.Members =
        [
            new CompleteRelationMember { Member = way1, Role = "outer" },
            new CompleteRelationMember { Member = way2, Role = "outer" },
            new CompleteRelationMember { Member = way3, Role = "outer" }
        ];

        var feature = _converter.ToGeoJson(relation);
        var multiLineString = feature.Geometry as MultiLineString;

        Assert.IsNotNull(multiLineString);
        var isValidOp = new IsValidOp(multiLineString);
        Assert.IsTrue(isValidOp.IsValid);
        Assert.AreEqual(1, multiLineString.Geometries.Length);
        Assert.AreEqual(6, multiLineString.Geometries.First().Coordinates.Length);
        Assert.AreEqual(node5.Longitude, multiLineString.Geometries.First().Coordinates[5].X);
    }
        
    [TestMethod]
    public void ToGeoJson_ConvertUnsortedQAndORoutes_ShouldCreateMultiLineWithTwoLines()
    {
        var id = 0;
        var node1 = CreateNode(++id);
        var node2 = CreateNode(++id);
        var node3 = CreateNode(++id);
        var node4 = CreateNode(++id);
        var node5 = CreateNode(++id);
        var node6 = CreateNode(++id);
        var node7 = CreateNode(++id);

        var way1 = new CompleteWay { Id = ++id, Nodes = [node1, node2, node3, node1] };
        var way2 = new CompleteWay { Id = ++id, Nodes = [node4, node5, node6, node4] };
        var way3 = new CompleteWay { Id = ++id, Nodes = [node7, node5] };

        var relation = new CompleteRelation { Id = ++id, Tags = new TagsCollection() };
        relation.Tags.Add(NAME, NAME);
        relation.Members =
        [
            new CompleteRelationMember { Member = way1, Role = "outer" },
            new CompleteRelationMember { Member = way2, Role = "outer" },
            new CompleteRelationMember { Member = way3, Role = "outer" }
        ];

        var feature = _converter.ToGeoJson(relation);
        var multiLineString = feature.Geometry as MultiLineString;

        Assert.IsNotNull(multiLineString);
        var isValidOp = new IsValidOp(multiLineString);
        Assert.IsTrue(isValidOp.IsValid);
        Assert.AreEqual(2, multiLineString.Geometries.Length);
        Assert.AreEqual(4, multiLineString.Geometries.First().Coordinates.Length);
        Assert.AreEqual(5, multiLineString.Geometries.Last().Coordinates.Length);
        Assert.AreEqual(node5.Longitude, multiLineString.Geometries[1].Coordinates[4].X);
    }
}