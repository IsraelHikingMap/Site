using IsraelHiking.API.Executors;
using IsraelHiking.Common;
using IsraelHiking.Common.Extensions;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using Microsoft.VisualStudio.TestTools.UnitTesting;
using NetTopologySuite.Features;
using NetTopologySuite.Geometries;
using NSubstitute;
using System.Collections.Generic;
using System.Linq;

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
                {FeatureAttributes.POI_ICON, "icon" },
                {FeatureAttributes.POI_CATEGORY, Categories.OTHER },
                {FeatureAttributes.POI_SEARCH_FACTOR, 1.0 },
                {FeatureAttributes.DESCRIPTION, string.Empty }
            });
            feature.SetId();
            return feature;
        }

        [TestInitialize]
        public void TestInitialize()
        {
            var logger = Substitute.For<ILogger>();
            var reportLogger = Substitute.For<ILogger<FeaturesMergeExecutor>>();
            var options = Substitute.For<IOptions<ConfigurationData>>();
            options.Value.Returns(new ConfigurationData());
            _executor = new FeaturesMergeExecutor(options, new GeometryFactory(), reportLogger, logger);
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
        }

        [TestMethod]
        public void MergeFeatures_HasSameTitleDifferentSource_ShouldMergeWithLink()
        {
            var feature1 = CreateFeature("1", 0, 0);
            feature1.Attributes.AddOrUpdate(FeatureAttributes.NAME, "1");
            feature1.Attributes.AddOrUpdate(FeatureAttributes.NAME + ":he", "11");
            feature1.Attributes.AddOrUpdate(FeatureAttributes.POI_CATEGORY, Categories.NONE);
            feature1.Attributes.AddOrUpdate(FeatureAttributes.POI_SEARCH_FACTOR, 0.5);
            feature1.Attributes.AddOrUpdate(FeatureAttributes.POI_ICON, string.Empty);
            feature1.Attributes.AddOrUpdate(FeatureAttributes.POI_ICON_COLOR, "black");
            feature1.SetTitles();
            var feature2 = CreateFeature("2", 0, 0);
            feature2.Attributes.AddOrUpdate(FeatureAttributes.NAME, "2");
            feature2.Attributes.AddOrUpdate(FeatureAttributes.NAME + ":en", "11");
            feature2.Attributes.AddOrUpdate(FeatureAttributes.POI_SOURCE, Sources.INATURE);
            feature2.Attributes.AddOrUpdate(FeatureAttributes.POI_CATEGORY, Categories.INATURE);
            feature2.Attributes.AddOrUpdate(FeatureAttributes.POI_ICON, "icon-inature");
            feature2.Attributes.AddOrUpdate(FeatureAttributes.POI_SEARCH_FACTOR, 2.0);
            feature2.Attributes.AddOrUpdate(FeatureAttributes.POI_ICON_COLOR, "green");
            feature2.SetTitles();

            var results = _executor.Merge(new List<Feature> { feature1, feature2 });

            Assert.AreEqual(1, results.Count);
            Assert.AreEqual(Categories.INATURE, results.First().Attributes[FeatureAttributes.POI_CATEGORY]);
            Assert.AreEqual("1", results.First().Attributes[FeatureAttributes.ID]);
            Assert.AreEqual("icon-inature", results.First().Attributes[FeatureAttributes.POI_ICON]);
            Assert.AreEqual(2.0, results.First().Attributes[FeatureAttributes.POI_SEARCH_FACTOR]);
            Assert.AreEqual("green", results.First().Attributes[FeatureAttributes.POI_ICON_COLOR]);
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
        public void MergeFeatures_HasSameTitleBetweenEveryTwoOrderedAsBadlyAsPossible_ShouldMergeToASingleFeature()
        {
            var node1 = CreateFeature("1", -0.0008, 0);
            node1.Attributes.AddOrUpdate(FeatureAttributes.NAME, "1");
            node1.Attributes.AddOrUpdate(FeatureAttributes.NAME + ":he", "11");
            node1.SetTitles();
            var node2 = CreateFeature("2", 0.0008, 0);
            node2.Attributes.AddOrUpdate(FeatureAttributes.NAME, "2");
            node2.Attributes.AddOrUpdate(FeatureAttributes.NAME + ":en", "11");
            node2.SetTitles();
            var node3 = CreateFeature("3", 0, 0);
            node3.Attributes.AddOrUpdate(FeatureAttributes.NAME, "2");
            node3.Attributes.AddOrUpdate(FeatureAttributes.NAME + ":en", "11");
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

            var results = _executor.Merge(new List<Feature> { point, area });

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
        }

        [TestMethod]
        public void MergeFeatures_TwoPolygonsAndPoint_ShouldMerge()
        {
            var feature1 = CreateFeature("1", 0, 0);
            feature1.Geometry = new Polygon(new LinearRing(new[]
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

        [TestMethod]
        public void MergeFeatures_MultiLineWithLine_ShouldMergeAndCreateASingleMultiLine()
        {
            var feature1 = CreateFeature("1", 0, 0);
            feature1.Geometry = new MultiLineString(new LineString[]
            {
                new LineString(new[]
                    {
                        new Coordinate(0, 0),
                        new Coordinate(1, 1),
                        new Coordinate(2, 2)
                    }
                ),
                new LineString(new[]
                    {
                        new Coordinate(2.0001, 2),
                        new Coordinate(3, 3),
                        new Coordinate(4, 4)
                    }
                )
            });
            feature1.Attributes.AddOrUpdate(FeatureAttributes.NAME, "1");
            feature1.SetTitles();
            var feature2 = CreateFeature("2", 0, 0);
            feature2.Geometry = new LineString(new[]
                {
                    new Coordinate(0, 2),
                    new Coordinate(1, 1),
                    new Coordinate(2, 0)
                }
            );
            feature2.Attributes.AddOrUpdate(FeatureAttributes.NAME, "1");
            feature2.SetTitles();

            var results = _executor.Merge(new List<Feature> { feature1, feature2 });

            Assert.AreEqual(1, results.Count);
            var mls = results.First().Geometry as MultiLineString;
            Assert.IsNotNull(mls);
            Assert.AreEqual(3, mls.Geometries.Length);
        }

        [TestMethod]
        public void MergeFeatures_MultiPolygonWithPolygon_ShouldMergeAndCreateASingleMultiPolygon()
        {
            var feature1 = CreateFeature("1", 0, 0);
            feature1.Geometry = new MultiPolygon(new Polygon[]
            {
                new Polygon(new LinearRing(new[]
                    {
                        new Coordinate(0, 0),
                        new Coordinate(1, 1),
                        new Coordinate(2, 2),
                        new Coordinate(0, 0),
                    })
                ),
                new Polygon(new LinearRing(new[]
                    {
                        new Coordinate(2.0001, 2),
                        new Coordinate(3, 3),
                        new Coordinate(4, 4),
                        new Coordinate(2.0001, 2),
                    }
                ))
            });
            feature1.Attributes.AddOrUpdate(FeatureAttributes.NAME, "1");
            feature1.SetTitles();
            var feature2 = CreateFeature("2", 0, 0);
            feature2.Geometry = new Polygon(new LinearRing(new[]
                {
                    new Coordinate(0, 2),
                    new Coordinate(1, 1),
                    new Coordinate(2, 0),
                    new Coordinate(0, 2),
                })
            );
            feature2.Attributes.AddOrUpdate(FeatureAttributes.NAME, "1");
            feature2.SetTitles();

            var results = _executor.Merge(new List<Feature> { feature1, feature2 });

            Assert.AreEqual(1, results.Count);
            var mls = results.First().Geometry as MultiPolygon;
            Assert.IsNotNull(mls);
            Assert.AreEqual(3, mls.Geometries.Length);
        }

        [TestMethod]
        public void MergeFeatures_MultiPolygonWithPoint_ShouldMergeAndCreateASingleMultiPolygon()
        {
            var feature1 = CreateFeature("1", 0, 0);
            feature1.Geometry = new MultiPolygon(new Polygon[]
            {
                new Polygon(new LinearRing(new[]
                    {
                        new Coordinate(0, 0),
                        new Coordinate(1, 1),
                        new Coordinate(2, 0),
                        new Coordinate(0, 0),
                    })
                ),
                new Polygon(new LinearRing(new[]
                    {
                        new Coordinate(2.0001, 2),
                        new Coordinate(3, 3),
                        new Coordinate(4, 4),
                        new Coordinate(2.0001, 2),
                    }
                ))
            });
            feature1.Attributes.AddOrUpdate(FeatureAttributes.NAME, "1");
            feature1.SetTitles();
            var feature2 = CreateFeature("2", 0.5, 0.5);
            feature2.Attributes.AddOrUpdate(FeatureAttributes.NAME, "1");
            feature2.Attributes.AddOrUpdate(FeatureAttributes.POI_SOURCE, Sources.WIKIPEDIA);
            feature2.SetTitles();

            var results = _executor.Merge(new List<Feature> { feature1, feature2 });

            Assert.AreEqual(1, results.Count);
            var mls = results.First().Geometry as MultiPolygon;
            Assert.IsNotNull(mls);
            Assert.AreEqual(2, mls.Geometries.Length);
        }

        [TestMethod]
        public void MergeFeatures_TwoBusStopsAndWikipedia_ShouldMergeOnlyBusStops()
        {
            var node1 = CreateFeature("1", 0, 0);
            node1.Attributes.AddOrUpdate(FeatureAttributes.NAME, "bus");
            node1.Attributes.AddOrUpdate(FeatureAttributes.POI_ICON, "icon-bus-stop");
            node1.SetTitles();
            var node2 = CreateFeature("2", 0, 0);
            node2.Attributes.AddOrUpdate(FeatureAttributes.NAME, "bus");
            node2.Attributes.AddOrUpdate(FeatureAttributes.POI_ICON, "icon-bus-stop");
            node2.SetTitles();
            var node3 = CreateFeature("3", 0, 0);
            node3.Attributes.AddOrUpdate(FeatureAttributes.NAME, "bus");
            node3.Attributes.AddOrUpdate(FeatureAttributes.POI_ICON, "icon-wikipedia");
            node3.Attributes.AddOrUpdate(FeatureAttributes.POI_SOURCE, Sources.WIKIPEDIA);
            node3.SetTitles();

            var results = _executor.Merge(new List<Feature> { node1, node2, node3 });

            Assert.AreEqual(2, results.Count);
        }

        [TestMethod]
        public void MergeFeatures_WayAndNodeAreSortedBackwards_ShouldMergeWayToNode()
        {
            var way = CreateFeature("way_1", 0, 0);
            way.Attributes.AddOrUpdate(FeatureAttributes.NAME, "name");
            way.Geometry = new LineString(new[]
            {
                new Coordinate(0,0),
                new Coordinate(1,1)
            });
            way.SetTitles();
            var node = CreateFeature("node_2", 0, 0);
            node.Attributes.AddOrUpdate(FeatureAttributes.NAME, "name");
            node.SetTitles();

            var results = _executor.Merge(new List<Feature> { way, node });

            Assert.AreEqual(1, results.Count);
        }

        [TestMethod]
        public void MergeFeatures_FeatureHasDescriptionWebsiteAndImage_ShouldMergeThem()
        {
            var importantDescription = "hebrew description";
            var hebrewDescriptionKey = FeatureAttributes.DESCRIPTION + ":" + Languages.HEBREW;
            var node1 = CreateFeature("node_1", 0, 0);
            node1.Attributes.AddOrUpdate(FeatureAttributes.NAME, "name");
            node1.Attributes.AddOrUpdate(hebrewDescriptionKey, importantDescription);
            node1.Attributes.AddOrUpdate(FeatureAttributes.WEBSITE, "website");
            node1.Attributes.AddOrUpdate(FeatureAttributes.IMAGE_URL, "not-so-nice-looking-image.png");
            node1.SetTitles();
            var node2 = CreateFeature("node_2", 0, 0);
            node2.Attributes.AddOrUpdate(FeatureAttributes.NAME, "name");
            node2.Attributes.AddOrUpdate(FeatureAttributes.POI_SOURCE, Sources.INATURE);
            node2.Attributes.AddOrUpdate(hebrewDescriptionKey, "iNature description");
            node2.Attributes.AddOrUpdate(FeatureAttributes.WEBSITE, "inature.com");
            node2.Attributes.AddOrUpdate(FeatureAttributes.POI_SOURCE_IMAGE_URL, "inature.com/image");
            node2.Attributes.AddOrUpdate(FeatureAttributes.IMAGE_URL, "nice-looking-image.png");
            node2.SetTitles();
            var node3 = CreateFeature("node_2", 0, 0);
            node3.Attributes.AddOrUpdate(FeatureAttributes.NAME, "name");
            node3.Attributes.AddOrUpdate(FeatureAttributes.POI_SOURCE, Sources.WIKIPEDIA);
            node3.Attributes.AddOrUpdate(FeatureAttributes.WEBSITE, "wikipedia.com");
            node3.Attributes.AddOrUpdate(FeatureAttributes.POI_SOURCE_IMAGE_URL, "wikipedia.com/image");
            node3.Attributes.AddOrUpdate(hebrewDescriptionKey, "wiki description");
            node3.SetTitles();

            var results = _executor.Merge(new List<Feature> { node1, node2, node3 });

            Assert.AreEqual(1, results.Count);
            Assert.AreEqual(importantDescription, results.First().Attributes[hebrewDescriptionKey].ToString());
            Assert.AreEqual(3, results.First().Attributes.GetNames().Where(n => n.StartsWith(FeatureAttributes.WEBSITE)).Count());
            Assert.AreEqual(2, results.First().Attributes.GetNames().Where(n => n.StartsWith(FeatureAttributes.POI_SOURCE_IMAGE_URL)).Count());
            Assert.AreEqual(2, results.First().Attributes.GetNames().Where(n => n.StartsWith(FeatureAttributes.IMAGE_URL)).Count());
            Assert.IsFalse(results.First().Attributes.GetNames().Any(n => n == FeatureAttributes.POI_SOURCE_IMAGE_URL));
        }

        [TestMethod]
        public void MergeFeatures_RailwayAndPlace_ShouldNotMergeThem()
        {
            var node1 = CreateFeature("node_1", 0, 0);
            node1.Attributes.AddOrUpdate(FeatureAttributes.NAME, "name");
            node1.Attributes.AddOrUpdate("place", "city");
            node1.SetTitles();
            var node2 = CreateFeature("node_2", 0, 0);
            node2.Attributes.AddOrUpdate(FeatureAttributes.NAME, "name");
            node2.Attributes.AddOrUpdate("railway", "station");
            node2.SetTitles();

            var results = _executor.Merge(new List<Feature> { node1, node2 });

            Assert.AreEqual(2, results.Count);
        }

        [TestMethod]
        public void MergeFeatures_MultiplteMerges_ShouldMergeGeometriesRight()
        {
            var node1 = CreateFeature("node_1", -0.0008, 0);
            node1.Attributes.AddOrUpdate(FeatureAttributes.NAME, "name");
            node1.Attributes.AddOrUpdate(FeatureAttributes.NAME + "1", "name1");
            node1.Attributes.AddOrUpdate(FeatureAttributes.NAME + "2", "name2");
            node1.Attributes.AddOrUpdate(FeatureAttributes.NAME + "3", "name3");
            node1.SetTitles();

            var node2 = CreateFeature("node_2", 0.0008, 0);
            node2.Attributes.AddOrUpdate(FeatureAttributes.NAME, "name");
            node2.Attributes.AddOrUpdate(FeatureAttributes.NAME + "1", "name1");
            node2.Attributes.AddOrUpdate(FeatureAttributes.NAME + "2", "name2");
            node2.Attributes.AddOrUpdate(FeatureAttributes.NAME + "3", "name3");
            node2.SetTitles();

            var node3 = CreateFeature("node_3", 0.0008, 0);
            node3.Attributes.AddOrUpdate(FeatureAttributes.NAME, "name");
            node3.SetTitles();

            var node4 = CreateFeature("node_4", 0, 0);
            node4.Attributes.AddOrUpdate(FeatureAttributes.NAME, "name");
            node4.SetTitles();

            var results = _executor.Merge(new List<Feature> { node1, node2, node3, node4 });

            Assert.AreEqual(1, results.Count);
            var multiPoint = results.First().Geometry as MultiPoint;
            Assert.IsNotNull(multiPoint);
            Assert.AreEqual(0, multiPoint.Geometries.OfType<GeometryCollection>().Count());
            Assert.AreEqual(4, multiPoint.Geometries.Length);
        }

        [TestMethod]
        public void MergePlaceAndWay_ShouldMergePolygonIntoNode()
        {

            var placeNode = CreateFeature("1", 0.5, 0.6);
            placeNode.Attributes.AddOrUpdate("place", "any");
            placeNode.Attributes.AddOrUpdate(FeatureAttributes.NAME, "name");
            placeNode.Attributes.AddOrUpdate(FeatureAttributes.POI_CONTAINER, false);
            placeNode.SetTitles();

            var placeBoundary = CreateFeature("2", 0, 0);
            placeBoundary.Attributes.AddOrUpdate(FeatureAttributes.NAME, "name");
            placeBoundary.Attributes.AddOrUpdate("place", "any");
            placeBoundary.Attributes.AddOrUpdate(FeatureAttributes.POI_CONTAINER, true);
            placeBoundary.SetTitles();
            placeBoundary.Geometry = new Polygon(new LinearRing(new[]
            {
                new Coordinate(0,0),
                new Coordinate(0,1),
                new Coordinate(1,1),
                new Coordinate(1,0),
                new Coordinate(0,0),
            }));

            var results = _executor.Merge(new List<Feature>() { placeBoundary, placeNode });

            Assert.AreEqual(1, results.Count);
            Assert.IsTrue(results.First().Geometry is Polygon);
        }


        [TestMethod]
        public void MergePlaceNodeWithInPlaceWithinBondary_ShouldMergeAndRemove()
        {
            var placeNode = CreateFeature("1", 0.5, 0.6);
            placeNode.Attributes.AddOrUpdate("place", "any");
            placeNode.Attributes.AddOrUpdate(FeatureAttributes.NAME, "name");
            placeNode.Attributes.AddOrUpdate(FeatureAttributes.POI_CONTAINER, false);
            placeNode.SetTitles();

            var placeBoundary = CreateFeature("2", 0, 0);
            placeBoundary.Attributes.AddOrUpdate(FeatureAttributes.NAME, "name");
            placeBoundary.Attributes.AddOrUpdate("place", "any");
            placeBoundary.Attributes.AddOrUpdate(FeatureAttributes.POI_CONTAINER, true);
            placeBoundary.SetTitles();
            placeBoundary.Geometry = new Polygon(new LinearRing(new[]
            {
                new Coordinate(0,0),
                new Coordinate(0,1),
                new Coordinate(1,1),
                new Coordinate(1,0),
                new Coordinate(0,0),
            }));

            var placeBoundary2 = CreateFeature("3", 0, 0);
            placeBoundary2.Attributes.AddOrUpdate(FeatureAttributes.NAME, "name");
            placeBoundary2.Attributes.AddOrUpdate("boundary", "administrative");
            placeBoundary2.Attributes.AddOrUpdate("admin_level", 8);
            placeBoundary2.Attributes.AddOrUpdate(FeatureAttributes.POI_CONTAINER, true);
            placeBoundary2.SetTitles();
            placeBoundary2.Geometry = new Polygon(new LinearRing(new[]
            {
                new Coordinate(-1, -1),
                new Coordinate(-1, 2),
                new Coordinate(2,2),
                new Coordinate(2,-1),
                new Coordinate(-1,-1),
            }));

            var results = _executor.Merge(new List<Feature> { placeBoundary, placeBoundary2, placeNode }).ToList();

            Assert.AreEqual(1, results.Count);
        }

        [TestMethod]
        public void MergePlaceNodeWithInPlaceWithinBondary_NodeIsInsideBoundaryButNotInsidePlace_ShouldMergeAndRemove()
        {
            var placeNode = CreateFeature("1", -0.0001, -0.0001);
            placeNode.Attributes.AddOrUpdate("place", "any");
            placeNode.Attributes.AddOrUpdate(FeatureAttributes.NAME, "name");
            placeNode.Attributes.AddOrUpdate(FeatureAttributes.POI_CONTAINER, false);
            placeNode.SetTitles();

            var placeBoundary = CreateFeature("2", 0, 0);
            placeBoundary.Attributes.AddOrUpdate(FeatureAttributes.NAME, "name");
            placeBoundary.Attributes.AddOrUpdate("place", "any");
            placeBoundary.Attributes.AddOrUpdate(FeatureAttributes.POI_CONTAINER, true);
            placeBoundary.SetTitles();
            placeBoundary.Geometry = new Polygon(new LinearRing(new[]
            {
                new Coordinate(0,0),
                new Coordinate(0,1),
                new Coordinate(1,1),
                new Coordinate(1,0),
                new Coordinate(0,0),
            }));

            var placeBoundary2 = CreateFeature("3", 0, 0);
            placeBoundary2.Attributes.AddOrUpdate(FeatureAttributes.NAME, "name");
            placeBoundary2.Attributes.AddOrUpdate("boundary", "administrative");
            placeBoundary2.Attributes.AddOrUpdate("admin_level", 8);
            placeBoundary2.Attributes.AddOrUpdate(FeatureAttributes.POI_CONTAINER, true);
            placeBoundary2.SetTitles();
            placeBoundary2.Geometry = new Polygon(new LinearRing(new[]
            {
                new Coordinate(-1, -1),
                new Coordinate(-1, 2),
                new Coordinate(2,2),
                new Coordinate(2,-1),
                new Coordinate(-1,-1),
            }));

            var results = _executor.Merge(new List<Feature> { placeBoundary, placeBoundary2, placeNode }).ToList();

            Assert.AreEqual(1, results.Count);
            Assert.IsTrue(results.First().Geometry.IsValid);
        }
    }
}
