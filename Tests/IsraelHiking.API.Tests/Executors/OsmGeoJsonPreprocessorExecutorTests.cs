using System.Collections.Generic;
using System.Linq;
using IsraelHiking.API.Converters;
using IsraelHiking.API.Executors;
using IsraelHiking.API.Services;
using IsraelHiking.Common;
using IsraelHiking.Common.Configuration;
using IsraelHiking.Common.Extensions;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using Microsoft.VisualStudio.TestTools.UnitTesting;
using NetTopologySuite.Geometries;
using NSubstitute;
using OsmSharp;
using OsmSharp.Complete;
using OsmSharp.Tags;

namespace IsraelHiking.API.Tests.Executors;

[TestClass]
public class OsmGeoJsonPreprocessorExecutorTests
{
    private IOsmGeoJsonPreprocessorExecutor _preprocessorExecutor;

    [TestInitialize]
    public void TestInitialize()
    {
        var options = new ConfigurationData();
        var optionsProvider = Substitute.For<IOptions<ConfigurationData>>();
        optionsProvider.Value.Returns(options);
        _preprocessorExecutor = new OsmGeoJsonPreprocessorExecutor(Substitute.For<ILogger>(), 
            new OsmGeoJsonConverter(new GeometryFactory()), new TagsHelper(optionsProvider));
    }

    private Node CreateNode(int id)
    {
        return new Node
        {
            Id = id,
            Latitude = id,
            Longitude = id,
            Tags = new TagsCollection { { FeatureAttributes.NAME, FeatureAttributes.NAME } }
        };
    }

    private Node CreateNode(int id, double lat, double lng)
    {
        return new Node
        {
            Id = id,
            Latitude = lat,
            Longitude = lng,
            Tags = new TagsCollection { { FeatureAttributes.NAME, FeatureAttributes.NAME } }
        };
    }

    [TestMethod]
    public void PreprocessOneNode_ShouldNotDoAnyManipulation()
    {
        var node = CreateNode(1);
        var osmElements = new List<ICompleteOsmGeo> { node };

        var results = _preprocessorExecutor.Preprocess(osmElements);

        Assert.AreEqual(1, results.Count);
    }

    [TestMethod]
    public void PreprocessArea_ShouldGetGeoLocationCenter()
    {
        var node1 = CreateNode(1, 0, 0);
        var node2 = CreateNode(1, 0, 1);
        var node3 = CreateNode(1, 1, 1);
        var node4 = CreateNode(1, 1, 0);
        var way = new CompleteWay
        {
            Nodes = [node1, node2, node3, node4, node1],
            Tags = new TagsCollection
            {
                {FeatureAttributes.NAME, "name"}
            }
        };
        var osmElements = new List<ICompleteOsmGeo> { way };

        var results = _preprocessorExecutor.Preprocess(osmElements);

        Assert.AreEqual(1, results.Count);
        var geoLocation = results.First().GetLocation();
        Assert.IsNotNull(geoLocation);
        Assert.AreEqual(0.5, geoLocation.X);
        Assert.AreEqual(0.5, geoLocation.Y);
    }

    [TestMethod]
    public void PreprocessOneWay_ShouldGetGeoLocationAtStart()
    {
        var node1 = CreateNode(1);
        var node2 = CreateNode(2);
        var way = new CompleteWay
        {
            Nodes = [node1, node2],
            Tags = new TagsCollection
            {
                {FeatureAttributes.NAME, "name"}
            }
        };
        var osmElements = new List<ICompleteOsmGeo> { way };

        var results = _preprocessorExecutor.Preprocess(osmElements);

        Assert.AreEqual(1, results.Count);
        var geoLocation = results.First().GetLocation();
        Assert.IsNotNull(geoLocation);
        Assert.AreEqual(node1.Latitude, geoLocation.Y);
    }

    [TestMethod]
    public void PreprocessAreaRelationRoute_ShouldGetGeoLocationAtStart()
    {
        var node1 = CreateNode(1, 0, 0);
        var node2 = CreateNode(2, 1, 1);
        var node3 = CreateNode(3, 1, 0);
        var way1 = new CompleteWay
        {
            Nodes = [node1, node2, node3],
        };
        var way2 = new CompleteWay
        {
            Nodes = [node3, node1],
        };
        var relation = new CompleteRelation
        {
            Members =
            [
                new CompleteRelationMember { Member = way1, Role = "" },
                new CompleteRelationMember { Member = way2, Role = "" }
            ],
            Tags = new TagsCollection
            {
                {"route", "bike"}
            }
        };
        var osmElements = new List<ICompleteOsmGeo> { relation };

        var results = _preprocessorExecutor.Preprocess(osmElements);

        Assert.AreEqual(1, results.Count);
        var geoLocation = results.First().GetLocation();
        Assert.IsNotNull(geoLocation);
        Assert.AreEqual(node1.Latitude, geoLocation.Y);
    }

    [TestMethod]
    public void PreprocessOneWayAndOneRelationWithTheSameName_ShouldRemoveWayFromResults()
    {
        var node1 = CreateNode(1);
        var node2 = CreateNode(2);
        var way1 = new CompleteWay
        {
            Id = 5,
            Tags = new TagsCollection(),
            Nodes = [node1, node2]
        };
        way1.Tags.Add("name", "name");
        var relation = new CompleteRelation
        {
            Members =
            [
                new CompleteRelationMember { Member = way1, Role = "" }
            ],
            Tags = new TagsCollection
            {
                {"name", "name"}
            }
        };
        var osmElements = new List<ICompleteOsmGeo> { way1, relation };

        var results = _preprocessorExecutor.Preprocess(osmElements);

        Assert.AreEqual(1, results.Count);
        Assert.AreEqual(1, results.Count(f => f.Geometry is MultiLineString));
    }

    [TestMethod]
    public void PreprocessOneWayAndOneRelationWithDifferentName_ShouldNotRemoveWayFromResults()
    {
        var node1 = CreateNode(1);
        var node2 = CreateNode(2);
        var way1 = new CompleteWay
        {
            Id = 5,
            Tags = new TagsCollection(),
            Nodes = [node1, node2]
        };
        way1.Tags.Add("name", "name1");
        var relation = new CompleteRelation
        {
            Members =
            [
                new CompleteRelationMember { Member = way1, Role = "" }
            ],
            Tags = new TagsCollection
            {
                {"name", "name"}
            }
        };
        var osmElements = new List<ICompleteOsmGeo> { way1, relation };

        var results = _preprocessorExecutor.Preprocess(osmElements);

        Assert.AreEqual(2, results.Count);
        Assert.AreEqual(1, results.Count(f => f.Geometry is MultiLineString));
        Assert.AreEqual(1, results.Count(f => f.Geometry is LineString));
    }

    [TestMethod]
    public void Preprocess_Highways_ShouldPreProcess()
    {
        var list = new List<CompleteWay>
        {
            new CompleteWay
            {
                Id = 1,
                Tags = new TagsCollection
                {
                    {FeatureAttributes.NAME, "name"}
                },
                Nodes =
                [
                    new Node
                    {
                        Id = 2,
                        Latitude = 1,
                        Longitude = 1
                    },
                    new Node
                    {
                        Id = 3,
                        Latitude = 2,
                        Longitude = 2
                    }
                ]
            }
        };

        var results = _preprocessorExecutor.Preprocess(list);
            
        Assert.AreEqual(list.Count, results.Count);
    }
}