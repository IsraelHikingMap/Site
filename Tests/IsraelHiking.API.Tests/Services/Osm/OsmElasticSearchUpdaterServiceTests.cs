using System.Collections.Generic;
using System.IO;
using IsraelHiking.API.Executors;
using IsraelHiking.API.Services;
using IsraelHiking.API.Services.Osm;
using IsraelHiking.API.Services.Poi;
using IsraelHiking.Common;
using IsraelHiking.DataAccessInterfaces;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using Microsoft.VisualStudio.TestTools.UnitTesting;
using NetTopologySuite.Features;
using NSubstitute;
using OsmSharp;
using OsmSharp.Changesets;
using OsmSharp.Complete;

namespace IsraelHiking.API.Tests.Services.Osm
{
    [TestClass]
    public class OsmElasticSearchUpdaterServiceTests
    {
        private IOsmElasticSearchUpdaterService _service;
        private IHttpGatewayFactory _httpGatewayFactory;
        private IOsmRepository _osmRepository;
        private IElasticSearchGateway _elasticSearchGateway;
        private IOsmGeoJsonPreprocessorExecutor _geoJsonPreprocessorExecutor;

        [TestInitialize]
        public void TestInitialize()
        {
            _httpGatewayFactory = Substitute.For<IHttpGatewayFactory>();
            var options = new ConfigurationData();
            var optionsProvider = Substitute.For<IOptions<ConfigurationData>>();
            optionsProvider.Value.Returns(options);
            _elasticSearchGateway = Substitute.For<IElasticSearchGateway>();
            _osmRepository = Substitute.For<IOsmRepository>();
            _geoJsonPreprocessorExecutor = Substitute.For<IOsmGeoJsonPreprocessorExecutor>();
            
            _service = new OsmElasticSearchUpdaterService(_httpGatewayFactory, _elasticSearchGateway, _geoJsonPreprocessorExecutor, new TagsHelper(optionsProvider), _osmRepository, new IPointsOfInterestAdapter[0], Substitute.For<ILogger>());    
        }

        [TestMethod]
        public void TestRebuild_ShouldRebuildHighwaysAndPoints()
        {
            _service.Rebuild(new UpdateRequest { Highways = true, PointsOfInterest = true }, new MemoryStream()).Wait();

            _elasticSearchGateway.Received(1).UpdateHighwaysZeroDownTime(Arg.Any<List<Feature>>());
            _elasticSearchGateway.Received(1).UpdatePointsOfInterestZeroDownTime(Arg.Any<List<Feature>>());
        }

        [TestMethod]
        public void TestUpdate_EmptyOsmChangeFile_ShouldNotUpdateAnything()
        {
            var changes = new OsmChange {Create = new OsmGeo[0], Modify = new OsmGeo[0], Delete = new OsmGeo[0]};
            _geoJsonPreprocessorExecutor
                .Preprocess(Arg.Is<Dictionary<string, List<ICompleteOsmGeo>>>(x => x.Values.Count == 0))
                .Returns(new List<Feature>());
            //_geoJsonPreprocessorExecutor
            //    .AddAddress(Arg.Is<List<Feature>>(x => x.Count == 0), Arg.Any<List<Feature>>())
            //    .Returns(new List<Feature>());
            _geoJsonPreprocessorExecutor
                .Preprocess(Arg.Is<List<CompleteWay>>(x => x.Count == 0))
                .Returns(new List<Feature>());

            _service.Update(changes).Wait();

            _elasticSearchGateway.Received(1).UpdatePointsOfInterestData(Arg.Is<List<Feature>>(x => x.Count == 0));
            _elasticSearchGateway.Received(1).UpdateHighwaysData(Arg.Is<List<Feature>>(x => x.Count == 0));
        }

        /* HM TODO: bring this back
        [TestMethod]
        public void MergeFeatures_HasSameTitle_ShouldMerge()
        {
            var description = "description";
            var node1 = CreateNode(1, 0, 0);
            node1.Tags[FeatureAttributes.NAME] = "1";
            node1.Tags[FeatureAttributes.NAME + ":he"] = "11";
            var node2 = CreateNode(2, 0, 0);
            node2.Tags[FeatureAttributes.NAME] = "2";
            node2.Tags[FeatureAttributes.NAME + ":en"] = "11";
            node2.Tags[FeatureAttributes.DESCRIPTION] = description;
            var dictionary = new Dictionary<string, List<ICompleteOsmGeo>>
            {
                { "1", new List<ICompleteOsmGeo> {node1} },
                { "2", new List<ICompleteOsmGeo> {node2} },
            };
            var results = _preprocessorExecutor.Preprocess(dictionary);
            results = _preprocessorExecutor.MergeByTitle(results);

            Assert.AreEqual(1, results.Count);
            Assert.AreEqual(description, results.First().Attributes[FeatureAttributes.DESCRIPTION].ToString());
        }

        [TestMethod]
        public void MergeFeatures_HasSameTitleButFarAway_ShouldNotMerge()
        {
            var node1 = CreateNode(1, 0, 0);
            node1.Tags[FeatureAttributes.NAME] = "1";
            node1.Tags[FeatureAttributes.NAME + ":he"] = "11";
            var node2 = CreateNode(2, 1, 1);
            node2.Tags[FeatureAttributes.NAME] = "2";
            node2.Tags[FeatureAttributes.NAME + ":en"] = "11";
            var dictionary = new Dictionary<string, List<ICompleteOsmGeo>>
            {
                { "1", new List<ICompleteOsmGeo> {node1} },
                { "2", new List<ICompleteOsmGeo> {node2} },
            };
            var results = _preprocessorExecutor.Preprocess(dictionary);
            results = _preprocessorExecutor.MergeByTitle(results);

            Assert.AreEqual(2, results.Count);
        }

        [TestMethod]
        public void MergeFeatures_HasSameTitleBetweenEveryTwo_ShouldMergeToASingleFeature()
        {
            var node1 = CreateNode(1, 0, 0);
            node1.Tags[FeatureAttributes.NAME] = "1";
            node1.Tags[FeatureAttributes.NAME + ":he"] = "11";
            var node2 = CreateNode(2, 0, 0);
            node2.Tags[FeatureAttributes.NAME] = "2";
            node2.Tags[FeatureAttributes.NAME + ":en"] = "11";
            var node3 = CreateNode(3, 0, 0);
            node3.Tags[FeatureAttributes.NAME] = "2";
            node3.Tags[FeatureAttributes.NAME + ":en"] = "3";
            var dictionary = new Dictionary<string, List<ICompleteOsmGeo>>
            {
                { "1", new List<ICompleteOsmGeo> {node1} },
                { "2", new List<ICompleteOsmGeo> {node2, node3} },
            };
            var results = _preprocessorExecutor.Preprocess(dictionary);
            results = _preprocessorExecutor.MergeByTitle(results);

            Assert.AreEqual(1, results.Count);
            Assert.AreEqual(2, results.First().GetIdsFromCombinedPoi().Values.First().Count);
        }

        [TestMethod]
        public void MergeFeatures_AreaAndPoint_ShouldMergeGeometryOfAreaToPoint()
        {
            var node1 = CreateNode(1, 0, 0);
            var node2 = CreateNode(2, 0, 1);
            var node3 = CreateNode(3, 1, 1);
            var node4 = CreateNode(4, 1, 0);
            var node5 = CreateNode(5, 0.5, 0.6);
            node5.Tags.Add("historic", "ruins");
            var way1 = new CompleteWay
            {
                Id = 6,
                Tags = new TagsCollection
                {
                    {FeatureAttributes.NAME, FeatureAttributes.NAME},
                    {"historic", "ruins"}
                },
                Nodes = new[] { node1, node2, node3, node4, node1 }
            };
            var dictionary = new Dictionary<string, List<ICompleteOsmGeo>>
            {
                { FeatureAttributes.NAME, new List<ICompleteOsmGeo> {way1, node5 } },
            };
            var results = _preprocessorExecutor.Preprocess(dictionary);
            results = _preprocessorExecutor.MergeByTitle(results);

            Assert.AreEqual(1, results.Count);
            Assert.IsTrue(results.First().Geometry is Polygon);
        }
        */
    }
}
