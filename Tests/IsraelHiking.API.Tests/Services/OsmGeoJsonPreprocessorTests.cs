using System.Collections.Generic;
using System.Linq;
using IsraelHiking.API.Converters;
using IsraelHiking.API.Services.Osm;
using IsraelHiking.DataAccessInterfaces;
using Microsoft.VisualStudio.TestTools.UnitTesting;
using NetTopologySuite.Geometries;
using NSubstitute;
using OsmSharp.Collections.Tags;
using OsmSharp.Osm;

namespace IsraelHiking.API.Tests.Services
{
    [TestClass]
    public class OsmGeoJsonPreprocessorTests
    {
        private IOsmGeoJsonPreprocessor _preprocessor;

        [TestInitialize]
        public void TestInitialize()
        {
            _preprocessor = new OsmGeoJsonPreprocessor(Substitute.For<ILogger>(), new OsmGeoJsonConverter());
        }

        private Node CreateNode(int id)
        {
            return new Node
            {
                Id = id,
                Latitude = id,
                Longitude = id,
                Tags = new TagsCollection { { "name", "name" } }
            };
        }

        private Node CreateNode(int id, double lat, double lng)
        {
            return new Node
            {
                Id = id,
                Latitude = lat,
                Longitude = lng,
                Tags = new TagsCollection { { "name", "name" } }
            };
        }

        [TestMethod]
        public void PreprocessOneNode_ShouldNotDoAnyManipulation()
        {
            var node = CreateNode(1);
            var osmElements = new List<ICompleteOsmGeo> { node };
            var dictionary = new Dictionary<string, List<ICompleteOsmGeo>> { { "name", osmElements } };

            var results = _preprocessor.Preprocess(dictionary);

            Assert.AreEqual(1, results.Keys.Count);
            Assert.AreEqual(1, results[results.Keys.First()].Count);
        }

        [TestMethod]
        public void PreprocessOneWayAndOneRelation_ShouldRemoveWayAndAddItToRelation()
        {
            var node1 = CreateNode(1);
            var node2 = CreateNode(2);
            var node3 = CreateNode(3);
            var node4 = CreateNode(4);
            var way1 = CompleteWay.Create(5);
            way1.Nodes.AddRange(new[] { node1, node2 });
            way1.Tags.Add("waterway", "stream");
            var way2 = CompleteWay.Create(6);
            way2.Nodes.AddRange(new[] { node3, node4 });
            var osmElements = new List<ICompleteOsmGeo> { node1, node2, node3, node4, way1, way2 };
            var dictionary = new Dictionary<string, List<ICompleteOsmGeo>> { { "name", osmElements } };

            var results = _preprocessor.Preprocess(dictionary);

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
            var way1 = CompleteWay.Create(4);
            way1.Tags.Add("name", "name");
            way1.Tags.Add("place", "name");
            way1.Nodes.AddRange(new[] { node2, node3 });
            var way2 = CompleteWay.Create(5);
            way2.Tags.Add("name", "name");
            way2.Tags.Add("place", "name");
            way2.Nodes.AddRange(new[] { node1, node3 });
            var osmElements = new List<ICompleteOsmGeo> { node1, node2, node3, way1, way2 };
            var dictionary = new Dictionary<string, List<ICompleteOsmGeo>> { { "name", osmElements } };

            var results = _preprocessor.Preprocess(dictionary);

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
            var way1 = CompleteWay.Create(9);
            way1.Tags.Add("name", "name");
            way1.Tags.Add("place", "any");
            way1.Nodes.AddRange(new[] { node2, node3 });
            var way2 = CompleteWay.Create(10);
            way2.Tags.Add("name", "name");
            way2.Tags.Add("place", "any");
            way2.Nodes.AddRange(new[] { node1, node2 });
            var way3 = CompleteWay.Create(11);
            way3.Tags.Add("name", "name");
            way3.Tags.Add("place", "any");
            way3.Nodes.AddRange(new[] { node3, node4, node1 });
            var way4 = CompleteWay.Create(12);
            way4.Tags.Add("name", "name");
            way4.Tags.Add("place", "any");
            way4.Nodes.AddRange(new[] { node5, node6 });
            var way5 = CompleteWay.Create(13);
            way5.Tags.Add("name", "name");
            way5.Tags.Add("place", "any");
            way5.Nodes.AddRange(new[] { node7, node6 });
            var relations = CompleteRelation.Create(16);
            relations.Tags.Add("name", "name");
            relations.Tags.Add("place", "any");
            relations.Members.Add(new CompleteRelationMember { Member = way4 });
            relations.Members.Add(new CompleteRelationMember { Member = way5 });
            var osmElements = new List<ICompleteOsmGeo> { node1, node2, node3, node4, node5, node6, node7, node8, way1, way2, way3, way4, relations };
            var dictionary = new Dictionary<string, List<ICompleteOsmGeo>> { { "name", osmElements } };

            var results = _preprocessor.Preprocess(dictionary);

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
            var way1 = CompleteWay.Create(7);
            way1.Nodes.AddRange(new[] { node1, node2, node3, node4, node1 });
            way1.Tags.Add("name", container);
            var way2 = CompleteWay.Create(7);
            way2.Nodes.AddRange(new[] { node5, node6 });
            way2.Tags.Add("name", line);
            var osmElements1 = new List<ICompleteOsmGeo> { way1 };
            var osmElements2 = new List<ICompleteOsmGeo> { way2 };

            var dictionary = new Dictionary<string, List<ICompleteOsmGeo>> { { container, osmElements1 }, { line, osmElements2 } };

            var results = _preprocessor.Preprocess(dictionary);

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
            var way1 = CompleteWay.Create(6);
            way1.Nodes.AddRange(new[] { node1, node2, node3, node4, node1 });
            way1.Tags.Add("name", "name");
            var osmElements = new List<ICompleteOsmGeo> { node5, way1 };

            var dictionary = new Dictionary<string, List<ICompleteOsmGeo>> { { "name", osmElements } };

            var results = _preprocessor.Preprocess(dictionary);

            Assert.AreEqual(1, results[results.Keys.First()].Count);
            Assert.AreEqual(0.5, results[results.Keys.First()].First().Attributes["lat"]);
            Assert.AreEqual(0.6, results[results.Keys.First()].First().Attributes["lng"]);
        }
    }
}
