using System.Collections.Generic;
using System.Linq;
using GeoAPI.Geometries;
using IsraelHiking.API.Executors;
using IsraelHiking.Common;
using IsraelHiking.Common.Extensions;
using Microsoft.Extensions.Logging;
using Microsoft.VisualStudio.TestTools.UnitTesting;
using NetTopologySuite.Features;
using NetTopologySuite.Geometries;
using NSubstitute;

namespace IsraelHiking.API.Tests.Executors
{
    [TestClass]
    public class FeaturesMergeExecutorTests
    {
        private IFeaturesMergeExecutor _executor;

        private Feature CreateFeature(string id, double x, double y)
        {
            var feature = new Feature(new Point(x, y), new AttributesTable
            {
                {FeatureAttributes.ID, id},
                {FeatureAttributes.POI_SOURCE, Sources.OSM },
                {FeatureAttributes.ICON, "icon" },
                {FeatureAttributes.POI_CATEGORY, Categories.OTHER },
                {FeatureAttributes.SEARCH_FACTOR, 1 },
                {FeatureAttributes.DESCRIPTION, string.Empty }
            });
            return feature;
        }

        [TestInitialize]
        public void TestInitialize()
        {
            var logger = Substitute.For<ILogger>();
            var reportLogget = Substitute.For<ILogger<FeaturesMergeExecutor>>();
            _executor = new FeaturesMergeExecutor(reportLogget, logger);
        }

        [TestMethod]
        public void MergeFeatures_HasSameTitleOSMSource_ShouldMergeWithoutLink()
        {
            var feature1 = CreateFeature("1", 0, 0);
            feature1.Attributes.AddOrUpdate(FeatureAttributes.NAME, "1");
            feature1.Attributes.AddOrUpdate(FeatureAttributes.NAME + ":he", "11");
            feature1.Attributes.AddOrUpdate(FeatureAttributes.WEBSITE, "website");
            feature1.SetTitles();
            var feature2 = CreateFeature("2", 0, 0);
            feature2.Attributes.AddOrUpdate(FeatureAttributes.NAME, "2");
            feature2.Attributes.AddOrUpdate(FeatureAttributes.NAME + ":en", "11");
            feature2.Attributes.AddOrUpdate(FeatureAttributes.NAME + ":en", "11");
            feature2.SetTitles();
            var results = _executor.Merge(new List<Feature> { feature1, feature2 });

            Assert.AreEqual(1, results.Count);
            Assert.AreEqual(0, results.First().GetIdsFromCombinedPoi().Count);
        }

        [TestMethod]
        public void MergeFeatures_HasSameTitleDifferentSource_ShouldMergeWithLink()
        {
            var feature1 = CreateFeature("1", 0, 0);
            feature1.Attributes.AddOrUpdate(FeatureAttributes.NAME, "1");
            feature1.Attributes.AddOrUpdate(FeatureAttributes.NAME + ":he", "11");
            feature1.Attributes.AddOrUpdate(FeatureAttributes.POI_CATEGORY, Categories.NONE);
            feature1.Attributes.AddOrUpdate(FeatureAttributes.SEARCH_FACTOR, 0.5);
            feature1.Attributes.AddOrUpdate(FeatureAttributes.ICON, string.Empty);
            feature1.Attributes.AddOrUpdate(FeatureAttributes.ICON_COLOR, "black");
            feature1.SetTitles();
            var feature2 = CreateFeature("2", 0, 0);
            feature2.Attributes.AddOrUpdate(FeatureAttributes.NAME, "2");
            feature2.Attributes.AddOrUpdate(FeatureAttributes.NAME + ":en", "11");
            feature2.Attributes.AddOrUpdate(FeatureAttributes.POI_SOURCE, Sources.INATURE);
            feature2.Attributes.AddOrUpdate(FeatureAttributes.POI_CATEGORY, Categories.INATURE);
            feature2.Attributes.AddOrUpdate(FeatureAttributes.ICON, "icon-inature");
            feature2.Attributes.AddOrUpdate(FeatureAttributes.SEARCH_FACTOR, 2);
            feature2.Attributes.AddOrUpdate(FeatureAttributes.ICON_COLOR, "green");
            feature2.SetTitles();
            var results = _executor.Merge(new List<Feature> { feature1, feature2 });

            Assert.AreEqual(1, results.Count);
            Assert.AreEqual(1, results.First().GetIdsFromCombinedPoi().Count);
            Assert.AreEqual(Categories.INATURE, results.First().Attributes[FeatureAttributes.POI_CATEGORY]);
            Assert.AreEqual("1", results.First().Attributes[FeatureAttributes.ID]);
            Assert.AreEqual("icon-inature", results.First().Attributes[FeatureAttributes.ICON]);
            Assert.AreEqual(2, results.First().Attributes[FeatureAttributes.SEARCH_FACTOR]);
            Assert.AreEqual("green", results.First().Attributes[FeatureAttributes.ICON_COLOR]);
        }

        
        [TestMethod]
        public void MergeFeatures_HasSameTitleButFarAway_ShouldNotMerge()
        {
            var feature1 = CreateFeature("1", 0, 0);
            feature1.Attributes.AddOrUpdate(FeatureAttributes.NAME, "1");
            feature1.Attributes.AddOrUpdate(FeatureAttributes.NAME + ":he", "11");
            feature1.SetTitles();
            var feature2 = CreateFeature("2", 1, 1);
            feature2.Attributes.AddOrUpdate(FeatureAttributes.NAME, "2");
            feature2.Attributes.AddOrUpdate(FeatureAttributes.NAME + ":en", "11");
            feature2.SetTitles();
            var results = _executor.Merge(new List<Feature> { feature1, feature2 });

            Assert.AreEqual(2, results.Count);
            Assert.AreEqual(0, results.First().GetIdsFromCombinedPoi().Count);
        }

        [TestMethod]
        public void MergeFeatures_HasSameTitleBetweenEveryTwoOrdered_ShouldMergeToASingleFeature()
        {
            var node1 = CreateFeature("1", 0, 0);
            node1.Attributes.AddOrUpdate(FeatureAttributes.NAME, "1");
            node1.Attributes.AddOrUpdate(FeatureAttributes.NAME + ":he", "11");
            node1.SetTitles();
            var node2 = CreateFeature("2", -0.0008, 0);
            node2.Attributes.AddOrUpdate(FeatureAttributes.NAME, "2");
            node2.Attributes.AddOrUpdate(FeatureAttributes.NAME + ":en", "11");
            node2.SetTitles();
            var node3 = CreateFeature("3", 0.0008, 0);
            node3.Attributes.AddOrUpdate(FeatureAttributes.NAME, "2");
            node3.Attributes.AddOrUpdate(FeatureAttributes.NAME + ":en", "3");
            node3.SetTitles();
            var results = _executor.Merge(new List<Feature> { node1, node2, node3 });

            Assert.AreEqual(1, results.Count);
        }

        [TestMethod]
        public void MergeFeatures_HasSameTitleBetweenEveryTwoNotOrdered_ShouldMergeToASingleFeature()
        {
            var node1 = CreateFeature("1", -0.0008, 0);
            node1.Attributes.AddOrUpdate(FeatureAttributes.NAME, "1");
            node1.Attributes.AddOrUpdate(FeatureAttributes.NAME + ":he", "11");
            node1.SetTitles();
            var node2 = CreateFeature("2", 0, 0);
            node2.Attributes.AddOrUpdate(FeatureAttributes.NAME, "2");
            node2.Attributes.AddOrUpdate(FeatureAttributes.NAME + ":en", "11");
            node2.SetTitles();
            var node3 = CreateFeature("3", 0.0008, 0);
            node3.Attributes.AddOrUpdate(FeatureAttributes.NAME, "2");
            node3.Attributes.AddOrUpdate(FeatureAttributes.NAME + ":en", "3");
            node3.SetTitles();
            var results = _executor.Merge(new List<Feature> { node1, node2, node3 });

            Assert.AreEqual(1, results.Count);
        }

        [TestMethod]
        public void MergeFeatures_AreaAndPoint_ShouldMergeGeometryOfAreaToPoint()
        {
            var area = CreateFeature("way_1", 0, 0);
            area.Geometry = new Polygon(new LinearRing(new[]
            {
                new Coordinate(0, 0),
                new Coordinate(0, 1),
                new Coordinate(1, 1),
                new Coordinate(1, 0),
                new Coordinate(0, 0)
            }));
            area.Attributes.AddOrUpdate("historic", "ruins");
            area.Attributes.AddOrUpdate(FeatureAttributes.NAME, "1");
            area.SetTitles();
            var point = CreateFeature("node_2", 0.5, 0.6);
            point.Attributes.AddOrUpdate("historic", "ruins");
            point.Attributes.AddOrUpdate(FeatureAttributes.NAME, "1");
            point.SetTitles();
            var results = _executor.Merge(new List<Feature> {point, area});

            Assert.AreEqual(1, results.Count);
            Assert.IsTrue(results.First().Geometry is Polygon);
        }

        [TestMethod]
        public void MergeFeatures_OsmWithWikipediaTags_ShouldMerge()
        {
            var feature1 = CreateFeature("1", 0, 0);
            feature1.Attributes.AddOrUpdate(FeatureAttributes.NAME, "1");
            feature1.Attributes.AddOrUpdate(FeatureAttributes.WIKIPEDIA, "page");
            feature1.SetTitles();
            var feature2 = CreateFeature("2", 0, 0);
            feature2.Attributes.AddOrUpdate(FeatureAttributes.NAME, "2");
            feature2.Attributes.AddOrUpdate(FeatureAttributes.WIKIPEDIA, "page");
            feature2.Attributes.AddOrUpdate(FeatureAttributes.POI_SOURCE, Sources.WIKIPEDIA);
            feature2.SetTitles();
            var results = _executor.Merge(new List<Feature> { feature1, feature2 });

            Assert.AreEqual(1, results.Count);
            Assert.AreEqual(1, results.First().GetIdsFromCombinedPoi().Count);
        }

        [TestMethod]
        public void MergeFeatures_TwoPolygonsAndPoint_ShouldMerge()
        {
            var feature1 = CreateFeature("1", 0, 0);
            feature1.Geometry = new Polygon(new LinearRing(new []
            {
                new Coordinate(0, 0),
                new Coordinate(0, 1),
                new Coordinate(1, 1),
                new Coordinate(1, 0),
                new Coordinate(0, 0)
            }));
            feature1.Attributes.AddOrUpdate(FeatureAttributes.NAME, "1");
            feature1.SetTitles();
            var feature2 = CreateFeature("2", 0, 0);
            feature2.Geometry = new Polygon(new LinearRing(new[]
            {
                new Coordinate(-0.0001, -0.0001),
                new Coordinate(0, 0.5),
                new Coordinate(0.5, 0.5),
                new Coordinate(0.5, 0),
                new Coordinate(-0.0001, -0.0001)
            }));
            feature2.Attributes.AddOrUpdate(FeatureAttributes.NAME, "1");
            feature2.SetTitles();
            var feature3 = CreateFeature("3", 0.75, 0.75);
            feature3.Geometry = new Polygon(new LinearRing(new[]
            {
                new Coordinate(-1, -1),
                new Coordinate(-1, 0.75),
                new Coordinate(0.75, 0.75),
                new Coordinate(0.75, -1),
                new Coordinate(-1, -1)
            }));
            feature3.Attributes.AddOrUpdate(FeatureAttributes.NAME, "1");
            feature3.SetTitles();
            var results = _executor.Merge(new List<Feature> { feature1, feature2, feature3 });

            Assert.AreEqual(1, results.Count);
        }
    }
}
