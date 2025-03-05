using IsraelHiking.API.Executors;
using IsraelHiking.Common;
using IsraelHiking.Common.Configuration;
using IsraelHiking.Common.Extensions;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using Microsoft.VisualStudio.TestTools.UnitTesting;
using NetTopologySuite.Features;
using NetTopologySuite.Geometries;
using NSubstitute;
using System;
using System.Linq;
using System.Text;
using IsraelHiking.API.Gpx;
using NetTopologySuite.Operation.Valid;

namespace IsraelHiking.API.Tests.Executors;

[TestClass]
public class FeaturesMergeExecutorTests
{
    private IFeaturesMergeExecutor _executor;

    private IFeature CreateFeature(string id, double x, double y)
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
        feature.SetLastModified(DateTime.Now);
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
        feature1.Attributes.AddOrUpdate(FeatureAttributes.NAME + ":" + Languages.HEBREW, "11");
        feature1.Attributes.AddOrUpdate(FeatureAttributes.WEBSITE, "website");
        feature1.SetTitles();
        var feature2 = CreateFeature("2", 0, 0);
        feature2.Attributes.AddOrUpdate(FeatureAttributes.NAME, "1");
        feature2.Attributes.AddOrUpdate(FeatureAttributes.NAME + ":" + Languages.ENGLISH, "11");
        feature2.Attributes.AddOrUpdate(FeatureAttributes.NAME + ":" + Languages.ENGLISH, "11");
        feature2.SetTitles();

        var results = _executor.Merge([feature1, feature2], []);

        Assert.AreEqual(1, results.Count);
    }
        
    [TestMethod]
    public void MergeFeatures_HasSameMtbName_ShouldMerge()
    {
        var feature1 = CreateFeature("1", 0, 0);
        feature1.Attributes.AddOrUpdate(FeatureAttributes.MTB_NAME, "1");
        feature1.SetTitles();
        var feature2 = CreateFeature("2", 0, 0);
        feature2.Attributes.AddOrUpdate(FeatureAttributes.MTB_NAME, "1");
        feature2.SetTitles();

        var results = _executor.Merge([feature1, feature2], []);

        Assert.AreEqual(1, results.Count);
    }

    [TestMethod]
    public void MergeFeatures_HasSameTitleAndSameImagesAndWebsite_ShouldMergeWithoutLink()
    {
        var feature1 = CreateFeature("1", 0, 0);
        feature1.Attributes.AddOrUpdate(FeatureAttributes.NAME, "1");
        feature1.Attributes.AddOrUpdate(FeatureAttributes.IMAGE_URL, "images1");
        feature1.Attributes.AddOrUpdate(FeatureAttributes.WEBSITE, "web1");
        feature1.SetTitles();
        var feature2 = CreateFeature("2", 0, 0);
        feature2.Attributes.AddOrUpdate(FeatureAttributes.NAME, "1");
        feature2.Attributes.AddOrUpdate(FeatureAttributes.IMAGE_URL, "images1");
        feature2.Attributes.AddOrUpdate(FeatureAttributes.IMAGE_URL + "1", "images2");
        feature2.Attributes.AddOrUpdate(FeatureAttributes.WEBSITE, "web1");
        feature2.SetTitles();

        var results = _executor.Merge([feature1, feature2], []);

        Assert.AreEqual(1, results.Count);
        Assert.AreEqual(2, results.First().Attributes.GetNames().Count(n => n.StartsWith(FeatureAttributes.IMAGE_URL)));
        Assert.AreEqual(1, results.First().Attributes.GetNames().Count(n => n.StartsWith(FeatureAttributes.WEBSITE)));
    }

    [TestMethod]
    public void MergeFeatures_HasSameTitleButNotTheSameCategoryFamily_ShouldNotMerge()
    {
        var feature1 = CreateFeature("1", 0, 0);
        feature1.Attributes.AddOrUpdate(FeatureAttributes.NAME, "1");
        feature1.Attributes.AddOrUpdate(FeatureAttributes.POI_CATEGORY, Categories.ROUTE_4X4);
        feature1.SetTitles();
        var feature2 = CreateFeature("2", 0, 0);
        feature2.Attributes.AddOrUpdate(FeatureAttributes.NAME, "1");
        feature2.Attributes.AddOrUpdate(FeatureAttributes.POI_CATEGORY, Categories.HISTORIC);
        feature2.SetTitles();

        var results = _executor.Merge([feature1, feature2], []);

        Assert.AreEqual(2, results.Count);
    }

    [TestMethod]
    public void MergeFeatures_HasSameTitleDifferentSource_ShouldMergeWithLink()
    {
        var feature1 = CreateFeature("1", 0, 0);
        feature1.Attributes.AddOrUpdate(FeatureAttributes.NAME, "1");
        feature1.Attributes.AddOrUpdate(FeatureAttributes.NAME + ":" + Languages.HEBREW, "11");
        feature1.Attributes.AddOrUpdate(FeatureAttributes.POI_CATEGORY, Categories.NONE);
        feature1.Attributes.AddOrUpdate(FeatureAttributes.POI_SEARCH_FACTOR, 0.5);
        feature1.Attributes.AddOrUpdate(FeatureAttributes.POI_ICON, string.Empty);
        feature1.Attributes.AddOrUpdate(FeatureAttributes.POI_ICON_COLOR, "black");
        feature1.SetTitles();
        var feature2 = CreateFeature("2", 0, 0);
        feature2.Attributes.AddOrUpdate(FeatureAttributes.NAME, "11");
        feature2.Attributes.AddOrUpdate(FeatureAttributes.POI_SOURCE, Sources.INATURE);
        feature2.Attributes.AddOrUpdate(FeatureAttributes.POI_CATEGORY, Categories.INATURE);
        feature2.Attributes.AddOrUpdate(FeatureAttributes.POI_ICON, "icon-inature");
        feature2.Attributes.AddOrUpdate(FeatureAttributes.POI_SEARCH_FACTOR, 2.0);
        feature2.Attributes.AddOrUpdate(FeatureAttributes.POI_ICON_COLOR, "green");
        feature2.SetTitles();

        var results = _executor.Merge([feature1], [feature2]);

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
        feature1.Attributes.AddOrUpdate(FeatureAttributes.NAME + ":" + Languages.HEBREW, "11");
        feature1.SetTitles();
        var feature2 = CreateFeature("2", 0, 0.5);
        feature2.Attributes.AddOrUpdate(FeatureAttributes.NAME, "1");
        feature2.Attributes.AddOrUpdate(FeatureAttributes.NAME + ":" + Languages.ENGLISH, "11");
        feature2.SetTitles();

        var results = _executor.Merge([feature1, feature2], []);

        Assert.AreEqual(2, results.Count);
    }

    [TestMethod]
    public void MergeFeatures_HasSameTitleAndCloseEnoughFromExternalSource_ShouldMerge()
    {
        var feature1 = CreateFeature("1", 0, 0);
        feature1.Attributes.AddOrUpdate(FeatureAttributes.NAME, "1");
        feature1.SetTitles();
        var feature2 = CreateFeature("2", 0, 0.01);
        feature2.Attributes.AddOrUpdate(FeatureAttributes.NAME, "1");
        feature2.Attributes.AddOrUpdate(FeatureAttributes.POI_SOURCE, Sources.INATURE);
        feature2.SetTitles();

        var results = _executor.Merge([feature1], [feature2]);

        Assert.AreEqual(1, results.Count);
    }

    [TestMethod]
    public void MergeFeatures_HasSameTitleButFarAwayFromExternalSource_ShouldNotMerge()
    {
        var feature1 = CreateFeature("1", 0, 0);
        feature1.Attributes.AddOrUpdate(FeatureAttributes.NAME, "1");
        feature1.SetTitles();
        var feature2 = CreateFeature("2", 0, 0.2);
        feature2.Attributes.AddOrUpdate(FeatureAttributes.NAME, "1");
        feature2.Attributes.AddOrUpdate(FeatureAttributes.POI_SOURCE, Sources.INATURE);
        feature2.SetTitles();
        feature2.SetLocation(new Coordinate());

        var results = _executor.Merge([feature1], [feature2]);

        Assert.AreEqual(2, results.Count);
    }

    [TestMethod]
    public void MergeFeatures_HasSameTitleBetweenEveryTwoOrdered_ShouldMergeToASingleFeature()
    {
        var node1 = CreateFeature("1", 0, 0);
        node1.Attributes.AddOrUpdate(FeatureAttributes.NAME, "2");
        node1.SetTitles();
        var node2 = CreateFeature("2", -0.0008, 0);
        node2.Attributes.AddOrUpdate(FeatureAttributes.NAME, "2");
        node2.SetTitles();
        var node3 = CreateFeature("3", 0.0008, 0);
        node3.Attributes.AddOrUpdate(FeatureAttributes.NAME, "2");
        node3.SetTitles();

        var results = _executor.Merge([node1, node2, node3], []);

        Assert.AreEqual(1, results.Count);
    }

    [TestMethod]
    public void MergeFeatures_HasSameTitleBetweenEveryTwoNotOrdered_ShouldMergeToASingleFeature()
    {
        var node1 = CreateFeature("1", -0.0008, 0);
        node1.Attributes.AddOrUpdate(FeatureAttributes.NAME, "2");
        node1.SetTitles();
        var node2 = CreateFeature("2", 0, 0);
        node2.Attributes.AddOrUpdate(FeatureAttributes.NAME, "2");
        node2.SetTitles();
        var node3 = CreateFeature("3", 0.0008, 0);
        node3.Attributes.AddOrUpdate(FeatureAttributes.NAME, "2");
        node3.SetTitles();

        var results = _executor.Merge([node1, node2, node3], []);

        Assert.AreEqual(1, results.Count);
    }

    [TestMethod]
    public void MergeFeatures_HasSameTitleBetweenEveryTwoOrderedAsBadlyAsPossible_ShouldMergeToASingleFeature()
    {
        var node1 = CreateFeature("1", -0.0008, 0);
        node1.Attributes.AddOrUpdate(FeatureAttributes.NAME, "2");
        node1.SetTitles();
        var node2 = CreateFeature("2", 0.0008, 0);
        node2.Attributes.AddOrUpdate(FeatureAttributes.NAME, "2");
        node2.SetTitles();
        var node3 = CreateFeature("3", 0, 0);
        node3.Attributes.AddOrUpdate(FeatureAttributes.NAME, "2");
        node3.SetTitles();

        var results = _executor.Merge([node1, node2, node3], []);

        Assert.AreEqual(1, results.Count);
    }

    [TestMethod]
    public void MergeFeatures_AreaAndPoint_ShouldMergeGeometryOfAreaToPoint()
    {
        var area = CreateFeature("way_1", 0, 0);
        area.Geometry = new Polygon(new LinearRing([
            new Coordinate(0, 0),
            new Coordinate(0, 1),
            new Coordinate(1, 1),
            new Coordinate(1, 0),
            new Coordinate(0, 0)
        ]));
        area.Attributes.AddOrUpdate("historic", "ruins");
        area.Attributes.AddOrUpdate(FeatureAttributes.NAME, "1");
        area.SetTitles();
        var point = CreateFeature("node_2", 0.5, 0.6);
        point.Attributes.AddOrUpdate("historic", "ruins");
        point.Attributes.AddOrUpdate(FeatureAttributes.NAME, "1");
        point.SetTitles();

        var results = _executor.Merge([point, area], []);

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

        var results = _executor.Merge([feature1], [feature2]);

        Assert.AreEqual(1, results.Count);
    }

    [TestMethod]
    public void MergeFeatures_OsmWithWikidataTags_ShouldMerge()
    {
        var feature1 = CreateFeature("1", 0, 0);
        feature1.Attributes.AddOrUpdate(FeatureAttributes.NAME, "1");
        feature1.Attributes.AddOrUpdate(FeatureAttributes.WIKIDATA, "Q1234");
        feature1.SetTitles();
        feature1.SetLocation(feature1.Geometry.Coordinate);
        var feature2 = CreateFeature("Q1234", 0, 0);
        feature2.Attributes.AddOrUpdate(FeatureAttributes.NAME, "2");
        feature2.Attributes.AddOrUpdate(FeatureAttributes.POI_SOURCE, Sources.WIKIDATA);
        feature2.SetTitles();
        feature2.SetLocation(feature1.Geometry.Coordinate);
        var results = _executor.Merge([feature1], [feature2]);

        Assert.AreEqual(1, results.Count);
    }

    [TestMethod]
    public void MergeFeatures_WikidataAndWikipediaTags_ShouldMerge()
    {
        var feature1 = CreateFeature("1", 0, 0);
        feature1.Attributes.AddOrUpdate(FeatureAttributes.NAME, "1");
        feature1.Attributes.AddOrUpdate(FeatureAttributes.WIKIPEDIA, "page");
        feature1.Attributes.AddOrUpdate(FeatureAttributes.POI_SOURCE, Sources.WIKIDATA);
        feature1.SetTitles();
        feature1.SetLocation(feature1.Geometry.Coordinate);
        var feature2 = CreateFeature("2", 0, 0);
        feature2.Attributes.AddOrUpdate(FeatureAttributes.NAME, "1");
        feature2.Attributes.AddOrUpdate(FeatureAttributes.WIKIDATA, "page");
        feature2.Attributes.AddOrUpdate(FeatureAttributes.POI_SOURCE, Sources.WIKIPEDIA);
        feature2.SetTitles();
        feature2.SetLocation(feature1.Geometry.Coordinate);

        var results = _executor.Merge([], [feature1, feature2]);

        Assert.AreEqual(1, results.Count);
    }
        
    [TestMethod]
    public void MergeFeatures_OsmWithINatureTags_ShouldMerge()
    {
        var feature1 = CreateFeature("1", 0, 0);
        feature1.Attributes.AddOrUpdate(FeatureAttributes.NAME, "1");
        feature1.Attributes.AddOrUpdate(FeatureAttributes.INATURE_REF, "page");
        feature1.SetTitles();
        feature1.SetLocation(feature1.Geometry.Coordinate);
        var feature2 = CreateFeature("2", 0, 0);
        feature2.Attributes.AddOrUpdate(FeatureAttributes.NAME, "page");
        feature2.Attributes.AddOrUpdate(FeatureAttributes.POI_SOURCE, Sources.INATURE);
        feature2.SetTitles();
        feature2.SetLocation(feature2.Geometry.Coordinate);

        var results = _executor.Merge([feature1], [feature2]);

        Assert.AreEqual(1, results.Count);
    }

    [TestMethod]
    public void MergeFeatures_TwoPolygonsAndPoint_ShouldMerge()
    {
        var feature1 = CreateFeature("1", 0, 0);
        feature1.Geometry = new Polygon(new LinearRing([
            new Coordinate(0, 0),
            new Coordinate(0, 1),
            new Coordinate(1, 1),
            new Coordinate(1, 0),
            new Coordinate(0, 0)
        ]));
        feature1.Attributes.AddOrUpdate(FeatureAttributes.NAME, "1");
        feature1.SetTitles();
        var feature2 = CreateFeature("2", 0, 0);
        feature2.Geometry = new Polygon(new LinearRing([
            new Coordinate(-0.0001, -0.0001),
            new Coordinate(0, 0.5),
            new Coordinate(0.5, 0.5),
            new Coordinate(0.5, 0),
            new Coordinate(-0.0001, -0.0001)
        ]));
        feature2.Attributes.AddOrUpdate(FeatureAttributes.NAME, "1");
        feature2.SetTitles();
        var feature3 = CreateFeature("3", 0.75, 0.75);
        feature3.Geometry = new Polygon(new LinearRing([
            new Coordinate(-1, -1),
            new Coordinate(-1, 0.75),
            new Coordinate(0.75, 0.75),
            new Coordinate(0.75, -1),
            new Coordinate(-1, -1)
        ]));
        feature3.Attributes.AddOrUpdate(FeatureAttributes.NAME, "1");
        feature3.SetTitles();

        var results = _executor.Merge([feature1, feature2, feature3], []);

        Assert.AreEqual(1, results.Count);
    }

    [TestMethod]
    public void MergeFeatures_PolygonsAndLinestringOfHighway_ShouldMerge()
    {
        var feature1 = CreateFeature("1", 0, 0);
        feature1.Geometry = new Polygon(new LinearRing([
            new Coordinate(0, 0),
            new Coordinate(0, 1),
            new Coordinate(1, 1),
            new Coordinate(1, 0),
            new Coordinate(0, 0)
        ]));
        feature1.Attributes.AddOrUpdate(FeatureAttributes.NAME, "1");
        feature1.Attributes.AddOrUpdate("highway", "residential");
        feature1.SetTitles();
        var feature2 = CreateFeature("2", 0, 0);
        feature2.Geometry = new LineString([
            new Coordinate(-0.0001, -0.0001),
            new Coordinate(0, 0.5),
            new Coordinate(0.5, 0.5),
            new Coordinate(0.5, 0)
        ]);
        feature2.Attributes.AddOrUpdate(FeatureAttributes.NAME, "1");
        feature2.Attributes.AddOrUpdate("highway", "residential");
        feature2.SetTitles();

        var results = _executor.Merge([feature1, feature2], []);

        Assert.AreEqual(1, results.Count);
        Assert.AreEqual(OgcGeometryType.MultiLineString, results.First().Geometry.OgcGeometryType);
    }

    [TestMethod]
    public void MergeFeatures_MultiLineWithLine_ShouldMergeAndCreateASingleMultiLine()
    {
        var feature1 = CreateFeature("1", 0, 0);
        feature1.Geometry = new MultiLineString([
            new LineString([
                    new Coordinate(0, 0),
                    new Coordinate(1, 1),
                    new Coordinate(2, 2)
                ]
            ),
            new LineString([
                    new Coordinate(2.0001, 2),
                    new Coordinate(3, 3),
                    new Coordinate(4, 4)
                ]
            )
        ]);
        feature1.Attributes.AddOrUpdate(FeatureAttributes.NAME, "1");
        feature1.SetTitles();
        var feature2 = CreateFeature("2", 0, 0);
        feature2.Geometry = new LineString([
                new Coordinate(0, 2),
                new Coordinate(1, 1),
                new Coordinate(2, 0)
            ]
        );
        feature2.Attributes.AddOrUpdate(FeatureAttributes.NAME, "1");
        feature2.SetTitles();

        var results = _executor.Merge([feature1, feature2], []);

        Assert.AreEqual(1, results.Count);
        var mls = results.First().Geometry as MultiLineString;
        Assert.IsNotNull(mls);
        Assert.AreEqual(3, mls.Geometries.Length);
    }

    [TestMethod]
    public void MergeFeatures_MultiPolygonWithPolygon_ShouldMergeAndCreateASingleMultiPolygon()
    {
        var feature1 = CreateFeature("1", 0, 0);
        feature1.Geometry = new MultiPolygon([
            new Polygon(new LinearRing([
                    new Coordinate(0, 0),
                    new Coordinate(1, 1),
                    new Coordinate(2, 2),
                    new Coordinate(0, 0)
                ])
            ),
            new Polygon(new LinearRing([
                    new Coordinate(2.0001, 2),
                    new Coordinate(3, 3),
                    new Coordinate(4, 4),
                    new Coordinate(2.0001, 2)
                ]
            ))
        ]);
        feature1.Attributes.AddOrUpdate(FeatureAttributes.NAME, "1");
        feature1.SetTitles();
        var feature2 = CreateFeature("2", 0, 0);
        feature2.Geometry = new Polygon(new LinearRing([
                new Coordinate(0, 2),
                new Coordinate(1, 1),
                new Coordinate(2, 0),
                new Coordinate(0, 2)
            ])
        );
        feature2.Attributes.AddOrUpdate(FeatureAttributes.NAME, "1");
        feature2.SetTitles();

        var results = _executor.Merge([feature1, feature2], []);

        Assert.AreEqual(1, results.Count);
        var mls = results.First().Geometry as MultiPolygon;
        Assert.IsNotNull(mls);
        Assert.AreEqual(3, mls.Geometries.Length);
    }

    [TestMethod]
    public void MergeFeatures_PolygonWithOverlappingPolygon_ShouldMergeAndCreateASinglePolygon()
    {
        var feature1 = CreateFeature("1", 0, 0);
        feature1.Geometry = new Polygon(
            new LinearRing([
                new Coordinate(0, 0),
                new Coordinate(1, 0),
                new Coordinate(1, 1),
                new Coordinate(0, 1),
                new Coordinate(0, 0)
            ])
        );
        feature1.Attributes.AddOrUpdate(FeatureAttributes.NAME, "1");
        feature1.SetTitles();
        var feature2 = CreateFeature("2", 0, 0);
        feature2.Geometry = new Polygon(new LinearRing([
                new Coordinate(0.1, 0.1),
                new Coordinate(0.9, 0.1),
                new Coordinate(0.9, 1.1),
                new Coordinate(0.1, 1.1),
                new Coordinate(0.1, 0.1)
            ])
        );
        feature2.Attributes.AddOrUpdate(FeatureAttributes.NAME, "1");
        feature2.SetTitles();

        var results = _executor.Merge([feature1, feature2], []);

        Assert.AreEqual(1, results.Count);
        var isValidOp = new IsValidOp(results.First().Geometry);
        var polygon = results.First().Geometry as Polygon;
        Assert.IsTrue(isValidOp.IsValid);
        Assert.IsNotNull(polygon);
    }
        
    [TestMethod]
    public void MergeFeatures_PolygonWithCoveringPolygon_ShouldMergeAndCreateASinglePolygon()
    {
        var feature1 = CreateFeature("1", 0, 0);
        feature1.Geometry = new Polygon(
            new LinearRing([
                new Coordinate(0, 0),
                new Coordinate(1, 0),
                new Coordinate(1, 1),
                new Coordinate(0, 1),
                new Coordinate(0, 0)
            ])
        );
        feature1.Attributes.AddOrUpdate(FeatureAttributes.NAME, "1");
        feature1.SetTitles();
        var feature2 = CreateFeature("2", 0, 0);
        feature2.Geometry = new Polygon(new LinearRing([
                new Coordinate(0.1, 0.1),
                new Coordinate(0.9, 0.1),
                new Coordinate(0.9, 0.9),
                new Coordinate(0.1, 0.9),
                new Coordinate(0.1, 0.1)
            ])
        );
        feature2.Attributes.AddOrUpdate(FeatureAttributes.NAME, "1");
        feature2.SetTitles();

        var results = _executor.Merge([feature1, feature2], []);

        Assert.AreEqual(1, results.Count);
        var isValidOp = new IsValidOp(results.First().Geometry);
        var polygon = results.First().Geometry as Polygon;
        Assert.IsTrue(isValidOp.IsValid);
        Assert.IsNotNull(polygon);
    }
        
    [TestMethod]
    public void MergeFeatures_PolygonTouchingAnotherPolygon_ShouldMergeAndCreateASinglePolygon()
    {
        var feature1 = CreateFeature("1", 0, 0);
        feature1.Geometry = new Polygon(
            new LinearRing([
                new Coordinate(0, 0),
                new Coordinate(1, 0),
                new Coordinate(1, 1),
                new Coordinate(0, 1),
                new Coordinate(0, 0)
            ])
        );
        feature1.Attributes.AddOrUpdate(FeatureAttributes.NAME, "1");
        feature1.SetTitles();
        var feature2 = CreateFeature("2", 0, 0);
        feature2.Geometry = new Polygon(new LinearRing([
                new Coordinate(0, 0),
                new Coordinate(1, 0),
                new Coordinate(1, -1),
                new Coordinate(0, -1),
                new Coordinate(0, 0)
            ])
        );
        feature2.Attributes.AddOrUpdate(FeatureAttributes.NAME, "1");
        feature2.SetTitles();

        var results = _executor.Merge([feature1, feature2], []);

        Assert.AreEqual(1, results.Count);
        var isValidOp = new IsValidOp(results.First().Geometry);
        var polygon = results.First().Geometry as Polygon;
        Assert.IsTrue(isValidOp.IsValid);
        Assert.IsNotNull(polygon);
    }
        
    [TestMethod]
    public void MergeFeatures_MultiPolygonWithPoint_ShouldMergeAndCreateASingleMultiPolygon()
    {
        var feature1 = CreateFeature("1", 0, 0);
        feature1.Geometry = new MultiPolygon([
            new Polygon(new LinearRing([
                    new Coordinate(0, 0),
                    new Coordinate(1, 1),
                    new Coordinate(2, 0),
                    new Coordinate(0, 0)
                ])
            ),
            new Polygon(new LinearRing([
                    new Coordinate(2.0001, 2),
                    new Coordinate(3, 3),
                    new Coordinate(4, 4),
                    new Coordinate(2.0001, 2)
                ]
            ))
        ]);
        feature1.Attributes.AddOrUpdate(FeatureAttributes.NAME, "1");
        feature1.SetTitles();
        var feature2 = CreateFeature("2", 0.5, 0.5);
        feature2.Attributes.AddOrUpdate(FeatureAttributes.NAME, "1");
        feature2.Attributes.AddOrUpdate(FeatureAttributes.POI_SOURCE, Sources.WIKIPEDIA);
        feature2.SetTitles();

        var results = _executor.Merge([feature1], [feature2]);

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
        node3.SetLocation(new Coordinate());

        var results = _executor.Merge([node1, node2], [node3]);

        Assert.AreEqual(2, results.Count);
    }

    [TestMethod]
    public void MergeFeatures_WayAndNodeAreSortedBackwards_ShouldMergeWayToNode()
    {
        var way = CreateFeature("way_1", 0, 0);
        way.Attributes.AddOrUpdate(FeatureAttributes.NAME, "name");
        way.Geometry = new LineString([
            new Coordinate(0,0),
            new Coordinate(1,1)
        ]);
        way.SetTitles();
        var node = CreateFeature("node_2", 0, 0);
        node.Attributes.AddOrUpdate(FeatureAttributes.NAME, "name");
        node.SetTitles();

        var results = _executor.Merge([way, node], []);

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

        var results = _executor.Merge([node1], [node2, node3]);

        Assert.AreEqual(1, results.Count);
        Assert.AreEqual(importantDescription, results.First().Attributes[hebrewDescriptionKey].ToString());
        Assert.AreEqual(3, results.First().Attributes.GetNames().Count(n => n.StartsWith(FeatureAttributes.WEBSITE)));
        Assert.AreEqual(2, results.First().Attributes.GetNames().Count(n => n.StartsWith(FeatureAttributes.POI_SOURCE_IMAGE_URL)));
        Assert.AreEqual(2, results.First().Attributes.GetNames().Count(n => n.StartsWith(FeatureAttributes.IMAGE_URL)));
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

        var results = _executor.Merge([node1, node2], []);

        Assert.AreEqual(2, results.Count);
    }

    [TestMethod]
    public void MergeFeatures_MultipleMerges_ShouldMergeGeometriesRight()
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

        var results = _executor.Merge([node1, node2, node3, node4], []);

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
        placeBoundary.Geometry = new Polygon(new LinearRing([
            new Coordinate(0,0),
            new Coordinate(0,1),
            new Coordinate(1,1),
            new Coordinate(1,0),
            new Coordinate(0,0)
        ]));

        var results = _executor.Merge([placeBoundary, placeNode], []);

        Assert.AreEqual(1, results.Count);
        Assert.IsTrue(results.First().Geometry is Polygon);
    }


    [TestMethod]
    public void MergePlaceNodeWithInPlaceWithinBoundary_ShouldMergeAndRemove()
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
        placeBoundary.Geometry = new Polygon(new LinearRing([
            new Coordinate(0,0),
            new Coordinate(0,1),
            new Coordinate(1,1),
            new Coordinate(1,0),
            new Coordinate(0,0)
        ]));

        var placeBoundary2 = CreateFeature("3", 0, 0);
        placeBoundary2.Attributes.AddOrUpdate(FeatureAttributes.NAME, "name");
        placeBoundary2.Attributes.AddOrUpdate("boundary", "administrative");
        placeBoundary2.Attributes.AddOrUpdate("admin_level", 8);
        placeBoundary2.Attributes.AddOrUpdate(FeatureAttributes.POI_CONTAINER, true);
        placeBoundary2.SetTitles();
        placeBoundary2.Geometry = new Polygon(new LinearRing([
            new Coordinate(-1, -1),
            new Coordinate(-1, 2),
            new Coordinate(2,2),
            new Coordinate(2,-1),
            new Coordinate(-1,-1)
        ]));

        var results = _executor.Merge([placeBoundary, placeBoundary2, placeNode], []).ToList();

        Assert.AreEqual(1, results.Count);
    }

    [TestMethod]
    public void MergePlaceNodeWithInPlaceWithinBoundary_NodeIsInsideBoundaryButNotInsidePlace_ShouldMergeAndRemove()
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
        placeBoundary.Geometry = new Polygon(new LinearRing([
            new Coordinate(0,0),
            new Coordinate(0,1),
            new Coordinate(1,1),
            new Coordinate(1,0),
            new Coordinate(0,0)
        ]));

        var placeBoundary2 = CreateFeature("3", 0, 0);
        placeBoundary2.Attributes.AddOrUpdate(FeatureAttributes.NAME, "name");
        placeBoundary2.Attributes.AddOrUpdate("boundary", "administrative");
        placeBoundary2.Attributes.AddOrUpdate("admin_level", 8);
        placeBoundary2.Attributes.AddOrUpdate(FeatureAttributes.POI_CONTAINER, true);
        placeBoundary2.SetTitles();
        placeBoundary2.Geometry = new Polygon(new LinearRing([
            new Coordinate(-1, -1),
            new Coordinate(-1, 2),
            new Coordinate(2,2),
            new Coordinate(2,-1),
            new Coordinate(-1,-1)
        ]));

        var results = _executor.Merge([placeBoundary, placeBoundary2, placeNode], []).ToList();

        Assert.AreEqual(1, results.Count);
        Assert.IsTrue(results.First().Geometry.IsValid);
    }

    [TestMethod]
    public void MergeFeatures_HasSameTitleDifferentHighwayType_ShouldNotMerge()
    {
        var feature1 = CreateFeature("1", 0, 0);
        feature1.Attributes.AddOrUpdate(FeatureAttributes.NAME, "1");
        feature1.Attributes.AddOrUpdate("highway", "junction");
        feature1.SetTitles();
        var feature2 = CreateFeature("2", 0, 0);
        feature2.Attributes.AddOrUpdate(FeatureAttributes.NAME, "1");
        feature2.Attributes.AddOrUpdate("highway", "track");
        feature2.SetTitles();
        feature2.Geometry = new LineString([new Coordinate(0, 0), new Coordinate(1, 1)]);
        var results = _executor.Merge([feature1, feature2], []);

        Assert.AreEqual(2, results.Count);
    }

    [TestMethod]
    public void MergeFeatures_HasSameTitleWithSameWebsiteFromExternalSource_ShouldMergeAndAddSourceImageUrl()
    {
        var feature1 = CreateFeature("1", 0, 0);
        feature1.Attributes.AddOrUpdate(FeatureAttributes.NAME, "1");
        feature1.Attributes.AddOrUpdate(FeatureAttributes.WEBSITE, "website");
        feature1.SetTitles();
        var feature2 = CreateFeature("2", 0, 0);
        feature2.Attributes.AddOrUpdate(FeatureAttributes.NAME, "1");
        feature2.Attributes.AddOrUpdate(FeatureAttributes.POI_SOURCE, Sources.INATURE);
        feature2.Attributes.AddOrUpdate(FeatureAttributes.WEBSITE, "website");
        feature2.Attributes.AddOrUpdate(FeatureAttributes.POI_SOURCE_IMAGE_URL, "siu");
        feature2.SetTitles();
        var results = _executor.Merge([feature1], [feature2]);

        Assert.AreEqual(1, results.Count);
        Assert.IsTrue(results.First().Attributes.Exists(FeatureAttributes.POI_SOURCE_IMAGE_URL));
    }

    [TestMethod]
    public void MergeFeatures_HasSameTitleWithWebsiteOnlyFromExternalSource_ShouldMergeAndAddSourceImageUrl()
    {
        var feature1 = CreateFeature("1", 0, 0);
        feature1.Attributes.AddOrUpdate(FeatureAttributes.NAME, "1");
        feature1.SetTitles();
        var feature2 = CreateFeature("2", 0, 0);
        feature2.Attributes.AddOrUpdate(FeatureAttributes.NAME, "1");
        feature2.Attributes.AddOrUpdate(FeatureAttributes.POI_SOURCE, Sources.INATURE);
        feature2.Attributes.AddOrUpdate(FeatureAttributes.WEBSITE, "website");
        feature2.Attributes.AddOrUpdate(FeatureAttributes.POI_SOURCE_IMAGE_URL, "siu");
        feature2.SetTitles();
        var results = _executor.Merge([feature1], [feature2]);

        Assert.AreEqual(1, results.Count);
        Assert.IsTrue(results.First().Attributes.Exists(FeatureAttributes.POI_SOURCE_IMAGE_URL));
    }

    [TestMethod]
    public void MergeFeatures_SecondWebsiteOfSourceIsFromExternal_ShouldMergeAndAddSourceImageUrl()
    {
        var feature1 = CreateFeature("1", 0, 0);
        feature1.Attributes.AddOrUpdate(FeatureAttributes.NAME, "1");
        feature1.Attributes.AddOrUpdate(FeatureAttributes.WEBSITE, "web1");
        feature1.Attributes.AddOrUpdate(FeatureAttributes.WEBSITE + "1", "web2");
        feature1.SetTitles();
        var feature2 = CreateFeature("2", 0, 0);
        feature2.Attributes.AddOrUpdate(FeatureAttributes.NAME, "1");
        feature2.Attributes.AddOrUpdate(FeatureAttributes.POI_SOURCE, Sources.INATURE);
        feature2.Attributes.AddOrUpdate(FeatureAttributes.WEBSITE, "web2");
        feature2.Attributes.AddOrUpdate(FeatureAttributes.POI_SOURCE_IMAGE_URL, "siu");
        feature2.SetTitles();
        var results = _executor.Merge([feature1], [feature2]);

        Assert.AreEqual(1, results.Count);
        Assert.IsTrue(results.First().Attributes.Exists(FeatureAttributes.POI_SOURCE_IMAGE_URL + "1"));
    }

    [TestMethod]
    public void MergeFeatures_HasSameTitleWithSameMultipleWebsites_ShouldMergeAndAddSourceImageUrl()
    {
        var feature1 = CreateFeature("1", 0, 0);
        feature1.Attributes.AddOrUpdate(FeatureAttributes.NAME, "1");
        feature1.Attributes.AddOrUpdate(FeatureAttributes.WEBSITE, "web");
        feature1.SetTitles();
        var feature2 = CreateFeature("2", 0, 0);
        feature2.Attributes.AddOrUpdate(FeatureAttributes.NAME, "1");
        feature2.Attributes.AddOrUpdate(FeatureAttributes.POI_SOURCE, Sources.INATURE);
        feature2.Attributes.AddOrUpdate(FeatureAttributes.WEBSITE, "web");
        feature2.Attributes.AddOrUpdate(FeatureAttributes.POI_SOURCE_IMAGE_URL, "siu");
        feature2.SetTitles();
        var feature3 = CreateFeature("2", 0, 0);
        feature3.Attributes.AddOrUpdate(FeatureAttributes.NAME, "1");
        feature3.Attributes.AddOrUpdate(FeatureAttributes.POI_SOURCE, Sources.WIKIPEDIA);
        feature3.Attributes.AddOrUpdate(FeatureAttributes.WEBSITE, "web2");
        feature3.Attributes.AddOrUpdate(FeatureAttributes.POI_SOURCE_IMAGE_URL, "siu2");
        feature3.SetTitles();
        var results = _executor.Merge([feature1], [feature2, feature3]);

        Assert.AreEqual(1, results.Count);
        Assert.IsTrue(results.First().Attributes.Exists(FeatureAttributes.POI_SOURCE_IMAGE_URL));
        Assert.IsTrue(results.First().Attributes.Exists(FeatureAttributes.POI_SOURCE_IMAGE_URL + "1"));
        Assert.AreEqual(2, results.First().Attributes.GetNames().Count(n => n.StartsWith(FeatureAttributes.WEBSITE)));
    }

    [TestMethod]
    public void MergeFeatures_DescriptionOnlyExistsInExternalSource_ShouldMergeAndAddSpecialDescription()
    {
        var feature1 = CreateFeature("1", 0, 0);
        feature1.Attributes.AddOrUpdate(FeatureAttributes.NAME, "1");
        feature1.Attributes.DeleteAttribute(FeatureAttributes.DESCRIPTION);
        feature1.SetTitles();
        var feature2 = CreateFeature("2", 0, 0);
        feature2.Attributes.AddOrUpdate(FeatureAttributes.NAME, "1");
        feature2.Attributes.AddOrUpdate(FeatureAttributes.POI_SOURCE, Sources.INATURE);
        feature2.Attributes.AddOrUpdate(FeatureAttributes.DESCRIPTION, "description");
        feature2.SetTitles();
        var results = _executor.Merge([feature1], [feature2]);

        Assert.AreEqual(1, results.Count);
        Assert.IsFalse(results.First().Attributes.Exists(FeatureAttributes.DESCRIPTION));
        Assert.IsTrue(results.First().Attributes.Exists(FeatureAttributes.POI_EXTERNAL_DESCRIPTION));
    }

    [TestMethod]
    public void GeometryContains_ShouldBeExtendedToGeometryCollection()
    {
        var polygonGeometry = new Polygon(new LinearRing([
            new(0, 0),
            new(0, 1),
            new(1, 1),
            new(1, 0),
            new(0, 0)
        ]));
        var pointGeometry = new Point(0.5, 0.5);
        var polygonFeature = new Feature(polygonGeometry, new AttributesTable());
        var polygonCollection = new Feature(new GeometryCollection([polygonGeometry]),
            new AttributesTable());
        var pointFeature = new Feature(pointGeometry, new AttributesTable());
        var pointCollection = new Feature(new GeometryCollection([pointGeometry]),
            new AttributesTable());
        Assert.IsTrue(polygonCollection.GeometryContains(pointFeature));
        Assert.IsTrue(polygonCollection.GeometryContains(pointCollection));
        Assert.IsTrue(polygonFeature.GeometryContains(pointFeature));
        Assert.IsTrue(polygonFeature.GeometryContains(pointCollection));
    }
        
    [TestMethod]
    public void MergeGeometryCollectionToRegular_ShouldCreateASingleGeometryCollection()
    {
        var pointGeometry = new Point(0.5, 0.5);
        var pointFeature = new Feature(pointGeometry, new AttributesTable());
        var pointCollection = new Feature(new GeometryCollection([pointGeometry]),
            new AttributesTable());

        pointFeature.MergeGeometriesFrom(pointCollection, new GeometryFactory());
            
        Assert.IsTrue(pointFeature.Geometry is GeometryCollection);
        Assert.AreEqual(2, ((GeometryCollection) pointFeature.Geometry).Geometries.Length);
        Assert.IsTrue(((GeometryCollection) pointFeature.Geometry).Geometries.All(g => g.OgcGeometryType != OgcGeometryType.GeometryCollection));
    }
        
    [TestMethod]
    public void MergeGeometryCollectionToCollection_ShouldCreateASingleGeometryCollection()
    {
        var pointGeometry = new Point(0.5, 0.5);
        var pointCollection = new Feature(new GeometryCollection([pointGeometry]),
            new AttributesTable());
        var pointCollection2 = new Feature(new GeometryCollection([pointGeometry]),
            new AttributesTable());

        pointCollection.MergeGeometriesFrom(pointCollection2, new GeometryFactory());
            
        Assert.IsTrue(pointCollection.Geometry is GeometryCollection);
        Assert.AreEqual(2, ((GeometryCollection) pointCollection.Geometry).Geometries.Length);
        Assert.IsTrue(((GeometryCollection) pointCollection.Geometry).Geometries.All(g => g.OgcGeometryType != OgcGeometryType.GeometryCollection));
    }
        
    [TestMethod]
    public void MergeGeometryRegularToCollection_ShouldCreateASingleGeometryCollection()
    {
        var pointGeometry = new Point(0.5, 0.5);
        var pointFeature = new Feature(pointGeometry, new AttributesTable());
        var pointCollection = new Feature(new GeometryCollection([pointGeometry]),
            new AttributesTable());

        pointCollection.MergeGeometriesFrom(pointFeature, new GeometryFactory());
            
        Assert.IsTrue(pointCollection.Geometry is GeometryCollection);
        Assert.AreEqual(2, ((GeometryCollection) pointCollection.Geometry).Geometries.Length);
        Assert.IsTrue(((GeometryCollection) pointCollection.Geometry).Geometries.All(g => g.OgcGeometryType != OgcGeometryType.GeometryCollection));
    }
        
    [TestMethod]
    public void MergeGeometryRegularToRegular_ShouldCreateASingleGeometryCollection()
    {
        var pointGeometry = new Point(0.5, 0.5);
        var pointFeature = new Feature(pointGeometry, new AttributesTable());
        var pointFeature2 = new Feature(pointGeometry, new AttributesTable());

        pointFeature.MergeGeometriesFrom(pointFeature2, new GeometryFactory());
            
        Assert.IsTrue(pointFeature.Geometry is GeometryCollection);
        Assert.AreEqual(2, ((GeometryCollection) pointFeature.Geometry).Geometries.Length);
        Assert.IsTrue(((GeometryCollection) pointFeature.Geometry).Geometries.All(g => g.OgcGeometryType != OgcGeometryType.GeometryCollection));
    }

    [TestMethod]
    public void ValidateTitlesParsing()
    {
        var featureString =
            @"
                {
                    ""type"": ""FeatureCollection"",
                    ""features"": [{
                        ""type"": ""Feature"",
                        ""geometry"": {
                            ""type"": ""Point"",
                            ""coordinates"": [1,2]
                        },
                        ""properties"": {
                            ""poiNames"": {
                                ""he"": [""name1"", ""name2""],
                                ""en"": [""name3"", ""name4""],
                                ""all"": [""name1"", ""name2"", ""name3"", ""name4""]
                            }
                        }
                    }]
                }";

        var collection = Encoding.UTF8.GetBytes(featureString).ToFeatureCollection();
        Assert.AreEqual(4, collection.First().GetTitles().Length);
    }
}