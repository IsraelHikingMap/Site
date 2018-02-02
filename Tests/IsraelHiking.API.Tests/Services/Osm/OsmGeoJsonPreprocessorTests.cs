using System.Collections.Generic;
using System.Linq;
using IsraelHiking.API.Converters;
using IsraelHiking.API.Executors;
using IsraelHiking.API.Services;
using IsraelHiking.Common;
using Microsoft.VisualStudio.TestTools.UnitTesting;
using NetTopologySuite.Geometries;
using NSubstitute;
using OsmSharp;
using Microsoft.Extensions.Options;
using OsmSharp.Tags;
using Microsoft.Extensions.Logging;
using NetTopologySuite.Features;
using OsmSharp.Complete;

namespace IsraelHiking.API.Tests.Services.Osm
{
    [TestClass]
    public class OsmGeoJsonPreprocessorTests
    {
        private IOsmGeoJsonPreprocessorExecutor _preprocessorExecutor;

        [TestInitialize]
        public void TestInitialize()
        {
            var options = new ConfigurationData();
            var optionsProvider = Substitute.For<IOptions<ConfigurationData>>();
            optionsProvider.Value.Returns(options);
            _preprocessorExecutor = new OsmGeoJsonPreprocessorExecutor(Substitute.For<ILogger>(), new OsmGeoJsonConverter(), new TagsHelper(optionsProvider));
        }

        private Node CreateNode(int id)
        {
            return new Node
            {
                Id = id,
                Latitude = id,
                Longitude = id,
                Tags = new TagsCollection { { FeatureAttributes.NAME, "name" } }
            };
        }

        private Node CreateNode(int id, double lat, double lng)
        {
            return new Node
            {
                Id = id,
                Latitude = lat,
                Longitude = lng,
                Tags = new TagsCollection { { FeatureAttributes.NAME, "name" } }
            };
        }

        [TestMethod]
        public void PreprocessOneNode_ShouldNotDoAnyManipulation()
        {
            var node = CreateNode(1);
            var osmElements = new List<ICompleteOsmGeo> { node };
            var dictionary = new Dictionary<string, List<ICompleteOsmGeo>> { { FeatureAttributes.NAME, osmElements } };

            var results = _preprocessorExecutor.Preprocess(dictionary);

            Assert.AreEqual(1, results.Keys.Count);
            Assert.AreEqual(1, results[results.Keys.First()].Count);
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
                Nodes = new[] { node1, node2, node3, node4, node1 },
                Tags = new TagsCollection
                {
                    {FeatureAttributes.NAME, "name"}
                }
            };
            var osmElements = new List<ICompleteOsmGeo> { way };
            var dictionary = new Dictionary<string, List<ICompleteOsmGeo>> { { FeatureAttributes.NAME, osmElements } };

            var results = _preprocessorExecutor.Preprocess(dictionary);

            Assert.AreEqual(1, results.Keys.Count);
            Assert.AreEqual(1, results[results.Keys.First()].Count);
            var geoLocation = results[results.Keys.First()].First().Attributes[FeatureAttributes.GEOLOCATION] as IAttributesTable;
            Assert.IsNotNull(geoLocation);
            Assert.AreEqual(0.5, geoLocation[FeatureAttributes.LAT]);
            Assert.AreEqual(0.5, geoLocation[FeatureAttributes.LAT]);
        }

        [TestMethod]
        public void PreprocessOneWay_ShouldGetGeoLocationAtStart()
        {
            var node1 = CreateNode(1);
            var node2 = CreateNode(2);
            var way = new CompleteWay
            {
                Nodes = new[] {node1, node2},
                Tags = new TagsCollection
                {
                    {FeatureAttributes.NAME, "name"}
                }
            };
            var osmElements = new List<ICompleteOsmGeo> { way };
            var dictionary = new Dictionary<string, List<ICompleteOsmGeo>> { { FeatureAttributes.NAME, osmElements } };

            var results = _preprocessorExecutor.Preprocess(dictionary);

            Assert.AreEqual(1, results.Keys.Count);
            Assert.AreEqual(1, results[results.Keys.First()].Count);
            var geoLocation = results[results.Keys.First()].First().Attributes[FeatureAttributes.GEOLOCATION] as IAttributesTable;
            Assert.IsNotNull(geoLocation);
            Assert.AreEqual(node1.Latitude, geoLocation[FeatureAttributes.LAT]);
        }

        [TestMethod]
        public void PreprocessAreaRelationRoute_ShouldGetGeoLocationAtStart()
        {
            var node1 = CreateNode(1, 0, 0);
            var node2 = CreateNode(2, 1, 1);
            var node3 = CreateNode(2, 1, 0);
            var way1 = new CompleteWay
            {
                Nodes = new[] { node1, node2, node3 },
            };
            var way2 = new CompleteWay
            {
                Nodes = new[] { node3, node1 },
            };
            var relaction = new CompleteRelation
            {
                Members = new []
                {
                    new CompleteRelationMember { Member = way1, Role = "" },
                    new CompleteRelationMember { Member = way2, Role = "" },
                },
                Tags = new TagsCollection
                {
                    {"route", "bike"}
                }
            };
            var osmElements = new List<ICompleteOsmGeo> { relaction };
            var dictionary = new Dictionary<string, List<ICompleteOsmGeo>> { { FeatureAttributes.NAME, osmElements } };

            var results = _preprocessorExecutor.Preprocess(dictionary);

            Assert.AreEqual(1, results.Keys.Count);
            Assert.AreEqual(1, results[results.Keys.First()].Count);
            var geoLocation = results[results.Keys.First()].First().Attributes[FeatureAttributes.GEOLOCATION] as IAttributesTable;
            Assert.IsNotNull(geoLocation);
            Assert.AreEqual(node1.Latitude, geoLocation[FeatureAttributes.LAT]);
        }

        [TestMethod]
        public void PreprocessOneWayAndOneRelation_ShouldRemoveWayAndAddItToRelation()
        {
            var node1 = CreateNode(1);
            var node2 = CreateNode(2);
            var node3 = CreateNode(3);
            var node4 = CreateNode(4);
            var way1 = new CompleteWay
            {
                Id = 5,
                Tags = new TagsCollection(),
                Nodes = new[] {node1, node2}
            };
            way1.Tags.Add("waterway", "stream");
            var way2 = new CompleteWay
            {
                Id = 6,
                Tags = new TagsCollection(),
                Nodes = new[] {node3, node4}
            };
            var osmElements = new List<ICompleteOsmGeo> { node1, node2, node3, node4, way1, way2 };
            var dictionary = new Dictionary<string, List<ICompleteOsmGeo>> { { FeatureAttributes.NAME, osmElements } };

            var results = _preprocessorExecutor.Preprocess(dictionary);

            Assert.AreEqual(5, results[results.Keys.First()].Count);
            Assert.AreEqual(4, results[results.Keys.First()].Count(f => f.Geometry is Point));
            Assert.AreEqual(1, results[results.Keys.First()].Count(f => f.Geometry is LineString));
        }

        [TestMethod]
        public void PreprocessWaysWithSameDirection_ShouldReturnOneLineString()
        {
            var node1 = CreateNode(1);
            var node2 = CreateNode(2);
            var node3 = CreateNode(3);
            var way1 = new CompleteWay { Id = 4, Tags = new TagsCollection() };
            way1.Tags.Add(FeatureAttributes.NAME, "name");
            way1.Tags.Add("place", "name");
            way1.Nodes = new[] { node2, node3 };
            var way2 = new CompleteWay { Id = 5, Tags = new TagsCollection() };
            way2.Tags.Add(FeatureAttributes.NAME, "name");
            way2.Tags.Add("place", "name");
            way2.Nodes = new[] { node1, node3 };
            var osmElements = new List<ICompleteOsmGeo> { node1, node2, node3, way1, way2 };
            var dictionary = new Dictionary<string, List<ICompleteOsmGeo>> { { FeatureAttributes.NAME, osmElements } };

            var results = _preprocessorExecutor.Preprocess(dictionary);

            Assert.AreEqual(1, results[results.Keys.First()].Count(f => f.Geometry is LineString));
        }

        [TestMethod]
        public void PreprocessWithComplexRelation_ShouldMergeWays()
        {
            var node1 = CreateNode(1);
            var node2 = CreateNode(2);
            var node3 = CreateNode(3);
            var node4 = CreateNode(4);
            var node5 = CreateNode(5);
            var node6 = CreateNode(6);
            var node7 = CreateNode(7);
            var node8 = CreateNode(8);
            node8.Tags.Add("place", "any");
            var way1 = new CompleteWay { Id = 9, Tags = new TagsCollection() };
            way1.Tags.Add(FeatureAttributes.NAME, "name");
            way1.Tags.Add("place", "any");
            way1.Nodes = new[] { node2, node3 };
            var way2 = new CompleteWay { Id = 10, Tags = new TagsCollection() };
            way2.Tags.Add(FeatureAttributes.NAME, "name");
            way2.Tags.Add("place", "any");
            way2.Nodes = new[] { node1, node2 };
            var way3 = new CompleteWay { Id = 11, Tags = new TagsCollection() };
            way3.Tags.Add(FeatureAttributes.NAME, "name");
            way3.Tags.Add("place", "any");
            way3.Nodes = new[] { node3, node4, node1 };
            var way4 = new CompleteWay { Id = 12, Tags = new TagsCollection() };
            way4.Tags.Add(FeatureAttributes.NAME, "name");
            way4.Tags.Add("place", "any");
            way4.Nodes = new[] { node5, node6 };
            var way5 = new CompleteWay { Id = 13, Tags = new TagsCollection() };
            way5.Tags.Add(FeatureAttributes.NAME, "name");
            way5.Tags.Add("place", "any");
            way5.Nodes = new[] { node7, node6 };
            var relations = new CompleteRelation { Id = 16, Tags = new TagsCollection() };
            relations.Tags.Add(FeatureAttributes.NAME, "name");
            relations.Tags.Add("place", "any");
            relations.Members = new[] {
                new CompleteRelationMember { Member = way4 },
                new CompleteRelationMember { Member = way5 }
            };
            var osmElements = new List<ICompleteOsmGeo> { node1, node2, node3, node4, node5, node6, node7, node8, way1, way2, way3, way4, relations };
            var dictionary = new Dictionary<string, List<ICompleteOsmGeo>> { { FeatureAttributes.NAME, osmElements } };

            var results = _preprocessorExecutor.Preprocess(dictionary);

            Assert.AreEqual(10, results[results.Keys.First()].Count);
            Assert.AreEqual(1, results[results.Keys.First()].Count(f => f.Geometry is Polygon));
            Assert.AreEqual(1, results[results.Keys.First()].Count(f => f.Geometry is MultiLineString));
        }


        [TestMethod]
        public void PreprocessTwoWays_OneIsInsideTheOther_ShouldAddAddress()
        {
            const string container = "container";
            const string line = "line";
            var node1 = CreateNode(1, 0, 0);
            var node2 = CreateNode(2, 0, 1);
            var node3 = CreateNode(3, 1, 1);
            var node4 = CreateNode(4, 1, 0);
            var node5 = CreateNode(5, 0.5, 0.5);
            var node6 = CreateNode(6, 0.6, 0.6);
            var way1 = new CompleteWay
            {
                Id = 7,
                Tags = new TagsCollection
                {
                    { "place", "city" }
                },
                Nodes = new[] {node1, node2, node3, node4, node1}
            };
            way1.Tags.Add(FeatureAttributes.NAME, container);
            var way2 = new CompleteWay
            {
                Id = 8,
                Tags = new TagsCollection(),
                Nodes = new[] {node5, node6}
            };
            way2.Tags.Add(FeatureAttributes.NAME, line);
            var osmElements1 = new List<ICompleteOsmGeo> { way1 };
            var osmElements2 = new List<ICompleteOsmGeo> { way2 };

            var dictionary = new Dictionary<string, List<ICompleteOsmGeo>> { { container, osmElements1 }, { line, osmElements2 } };

            var results = _preprocessorExecutor.Preprocess(dictionary);

            Assert.AreEqual(1, results[line].Count);
            Assert.AreEqual(1, results[container].Count);
            Assert.AreEqual(container, results[line].First(f => f.Geometry is LineString).Attributes["address"]);
        }

        [TestMethod]
        public void PreprocessWithPlaceAndWay_ShouldMergePlaceIntoIt()
        {
            var node1 = CreateNode(1, 0, 0);
            var node2 = CreateNode(2, 0, 1);
            var node3 = CreateNode(3, 1, 1);
            var node4 = CreateNode(4, 1, 0);
            var node5 = CreateNode(5, 0.5, 0.6);
            node5.Tags.Add("place", "any");
            var way1 = new CompleteWay
            {
                Id = 6,
                Tags = new TagsCollection { { FeatureAttributes.NAME, "name" }},
                Nodes = new[] {node1, node2, node3, node4, node1}
            };
            var osmElements = new List<ICompleteOsmGeo> { node5, way1 };

            var dictionary = new Dictionary<string, List<ICompleteOsmGeo>> { { FeatureAttributes.NAME, osmElements } };

            var results = _preprocessorExecutor.Preprocess(dictionary);

            Assert.AreEqual(1, results[results.Keys.First()].Count);
            var geoLocation = results[results.Keys.First()].First().Attributes[FeatureAttributes.GEOLOCATION] as AttributesTable;
            Assert.IsNotNull(geoLocation);
            Assert.AreEqual(0.5, geoLocation[FeatureAttributes.LAT]);
            Assert.AreEqual(0.6, geoLocation[FeatureAttributes.LON]);
        }

        [TestMethod]
        public void PreprocessWithOneWayTag_ShouldMergeAndReverse()
        {
            var node1 = CreateNode(1, 0, 0);
            var node2 = CreateNode(2, 1, 1);
            var node3 = CreateNode(3, 2, 2);
            var node4 = CreateNode(4, 3, 3);
            var node5 = CreateNode(5, 4, 4);
            var node6 = CreateNode(6, 5, 5);
            var way1 = new CompleteWay { Id = 7, Tags = new TagsCollection() };
            var way2 = new CompleteWay { Id = 8, Tags = new TagsCollection() };
            var way3 = new CompleteWay { Id = 9, Tags = new TagsCollection() };
            way1.Nodes = new[] { node1, node2, node3 };
            way2.Nodes = new[] { node5, node4, node3 };
            way3.Nodes = new[] { node5, node6 };
            way1.Tags.Add(FeatureAttributes.NAME, "name");
            way2.Tags.Add(FeatureAttributes.NAME, "name");
            way2.Tags.Add("oneway", "true");
            way3.Tags.Add(FeatureAttributes.NAME, "name");
            var osmElements = new List<ICompleteOsmGeo> { way1, way2, way3 };
            var dictionary = new Dictionary<string, List<ICompleteOsmGeo>> { { FeatureAttributes.NAME, osmElements } };

            var results = _preprocessorExecutor.Preprocess(dictionary);

            Assert.AreEqual(1, results[results.Keys.First()].Count);
            Assert.AreEqual(node6.Latitude, results[results.Keys.First()].First().Geometry.Coordinates.First().Y);
            Assert.AreEqual(node6.Longitude, results[results.Keys.First()].First().Geometry.Coordinates.First().X);
        }
    }
}
