using IsraelHiking.API.Controllers;
using IsraelHiking.API.Executors;
using IsraelHiking.API.Services;
using IsraelHiking.API.Services.Poi;
using IsraelHiking.Common;
using IsraelHiking.Common.Api;
using IsraelHiking.Common.Configuration;
using IsraelHiking.Common.Extensions;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Caching.Distributed;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using Microsoft.VisualStudio.TestTools.UnitTesting;
using NetTopologySuite.Features;
using NetTopologySuite.Geometries;
using NSubstitute;
using OsmSharp.IO.API;
using System;
using System.Linq;
using System.Text;

namespace IsraelHiking.API.Tests.Controllers;

[TestClass]
public class PointsOfInterestControllerTests
{
    private PointsOfInterestController _controller;
    private IAuthClient _osmGateway;
    private ITagsHelper _tagHelper;
    private IPointsOfInterestProvider _pointsOfInterestProvider;
    private IDistributedCache _persistentCache;
    private ISimplePointAdderExecutor _simplePointAdderExecutor;

    [TestInitialize]
    public void TestInitialize()
    {
        _pointsOfInterestProvider = Substitute.For<IPointsOfInterestProvider>();
        _tagHelper = Substitute.For<ITagsHelper>();
        _osmGateway = Substitute.For<IAuthClient>();
        Substitute.For<IImagesUrlsStorageExecutor>();
        _persistentCache = Substitute.For<IDistributedCache>();
        _simplePointAdderExecutor = Substitute.For<ISimplePointAdderExecutor>();
        var optionsProvider = Substitute.For<IOptions<ConfigurationData>>();
        optionsProvider.Value.Returns(new ConfigurationData());
        var factory = Substitute.For<IClientsFactory>();
        factory.CreateOAuth2Client(Arg.Any<string>()).Returns(_osmGateway);
        _controller = new PointsOfInterestController(factory, 
            _tagHelper, 
            _pointsOfInterestProvider,
            _simplePointAdderExecutor,
            _persistentCache,
            Substitute.For<ILogger>());
    }

    [TestMethod]
    public void GetPointOfInterest_WrongSource_ShouldReturnBadRequest()
    {
        _pointsOfInterestProvider.GetFeatureById(Arg.Any<string>(), Arg.Any<string>()).Returns(null as IFeature);
            
        var result = _controller.GetPointOfInterest("wrong source", string.Empty).Result as NotFoundResult;

        Assert.IsNotNull(result);
    }

    [TestMethod]
    public void GetPointOfInterest_BySourceAndId_ShouldReturnIt()
    {
        var id = "way_1";
        var source = "source";
        _pointsOfInterestProvider.GetFeatureById(source, id).Returns(new Feature());

        var result = _controller.GetPointOfInterest(source, id).Result as OkObjectResult;

        Assert.IsNotNull(result);
    }

    [TestMethod]
    public void CreatePointOfInterest_WrongSource_ShouldReturnBadRequest()
    {
        var poi = new Feature(new Point(0, 0), new AttributesTable { { FeatureAttributes.POI_SOURCE, "wrong source" }, {FeatureAttributes.POI_ID, "1"} });
            
        var result = _controller.CreatePointOfInterest(poi, Languages.HEBREW).Result as BadRequestObjectResult;

        Assert.IsNotNull(result);
    }

    [TestMethod]
    public void CreatePointOfInterest_AddressTooLong_ShouldReturnBadRequest()
    {
        var poi = new Feature(new Point(0, 0), new AttributesTable
        {
            { FeatureAttributes.POI_SOURCE, Sources.OSM },
            { FeatureAttributes.WEBSITE, string.Join("", Enumerable.Repeat("i", 256)) },
            { FeatureAttributes.POI_ID, "1" }
        });
            
        var result = _controller.CreatePointOfInterest(poi, Languages.HEBREW).Result as BadRequestObjectResult;

        Assert.IsNotNull(result);
    }

    [TestMethod]
    public void CreatePointOfInterest_ExistsInCache_ShouldNotAdd()
    {
        _controller.SetupIdentity();
        var poi = new Feature(new Point(0, 0), new AttributesTable {
            { FeatureAttributes.POI_SOURCE, Sources.OSM },
            { FeatureAttributes.POI_ICON, "icon" },
            { FeatureAttributes.POI_ID, Guid.NewGuid().ToString() },
        });
        poi.SetLocation(new Coordinate());
        _persistentCache.Get(Arg.Any<string>()).Returns(Encoding.UTF8.GetBytes("the id in the cache"));
        _pointsOfInterestProvider.GetFeatureById(Sources.OSM, "the id in the cache").Returns((Feature)null);

        var result = _controller.CreatePointOfInterest(poi, Languages.HEBREW).Result as BadRequestObjectResult;

        Assert.IsNotNull(result);
        _pointsOfInterestProvider.DidNotReceive().AddFeature(Arg.Any<Feature>(), _osmGateway, Arg.Any<string>());
    }

    [TestMethod]
    public void CreatePointOfInterest_DoesNotExistInCache_ShouldNotAdd()
    {
        _controller.SetupIdentity();
        var poi = new Feature(new Point(0, 0), new AttributesTable {
            { FeatureAttributes.POI_SOURCE, Sources.OSM },
            { FeatureAttributes.POI_ICON, "icon" },
            { FeatureAttributes.POI_ID, Guid.NewGuid().ToString() },
        });
        poi.SetLocation(new Coordinate(0, 0));
        _persistentCache.Get(Arg.Any<string>()).Returns((byte[])null);
        _pointsOfInterestProvider.AddFeature(poi, _osmGateway, Languages.HEBREW).Returns(new Feature(new Point(0,0), new AttributesTable
        {
            { FeatureAttributes.ID, "new id" }
        }));

        var result = _controller.CreatePointOfInterest(poi, Languages.HEBREW).Result as OkObjectResult;

        Assert.IsNotNull(result);
        var feature = result.Value as Feature;
        Assert.IsNotNull(feature);
        Assert.IsTrue(feature.Attributes.Exists(FeatureAttributes.ID));
    }

    [TestMethod]
    public void UpdatePointOfInterest_IncorrectId_ShouldNotUpdate()
    {
        _controller.SetupIdentity();
        var poi = new Feature(new Point(0, 0), new AttributesTable {
            { FeatureAttributes.POI_SOURCE, Sources.OSM },
            { FeatureAttributes.POI_ID, "1" },
            { FeatureAttributes.POI_ICON, "icon" },
        });
        poi.SetLocation(new Coordinate());

        var result = _controller.UpdatePointOfInterest("42", poi, Languages.HEBREW).Result as BadRequestObjectResult;

        Assert.IsNotNull(result);
        _pointsOfInterestProvider.DidNotReceive().UpdateFeature(Arg.Any<Feature>(), _osmGateway, Arg.Any<string>());
    }

    [TestMethod]
    public void UpdatePointOfInterest_WebsiteTooLong_ShouldNotUpdate()
    {
        _controller.SetupIdentity();
        var poi = new Feature(new Point(0, 0), new AttributesTable {
            { FeatureAttributes.POI_SOURCE, Sources.OSM },
            { FeatureAttributes.POI_ID, "1" },
            { FeatureAttributes.POI_ICON, "icon" },
            { FeatureAttributes.POI_ADDED_URLS, new [] { string.Join("", Enumerable.Repeat("i", 256)) } },
        });
        poi.SetLocation(new Coordinate());

        var result = _controller.UpdatePointOfInterest(poi.GetId(), poi, Languages.HEBREW).Result as BadRequestObjectResult;

        Assert.IsNotNull(result);
    }
        
    [TestMethod]
    public void UpdatePointOfInterest_DescriptionTooLong_ShouldNotUpdate()
    {
        _controller.SetupIdentity();
        var poi = new Feature(new Point(0, 0), new AttributesTable {
            { FeatureAttributes.POI_SOURCE, Sources.OSM },
            { FeatureAttributes.POI_ID, "1" },
            { FeatureAttributes.POI_ICON, "icon" },
            { FeatureAttributes.DESCRIPTION, string.Join("", Enumerable.Repeat("i", 256)) },
        });
        poi.SetLocation(new Coordinate());

        var result = _controller.UpdatePointOfInterest(poi.GetId(), poi, Languages.HEBREW).Result as BadRequestObjectResult;

        Assert.IsNotNull(result);
    }
        
    [TestMethod]
    public void UpdatePointOfInterest_TitleTooLong_ShouldNotUpdate()
    {
        _controller.SetupIdentity();
        var poi = new Feature(new Point(0, 0), new AttributesTable {
            { FeatureAttributes.POI_SOURCE, Sources.OSM },
            { FeatureAttributes.POI_ID, "1" },
            { FeatureAttributes.POI_ICON, "icon" },
            { FeatureAttributes.NAME, string.Join("", Enumerable.Repeat("i", 256)) },
        });
        poi.SetLocation(new Coordinate());

        var result = _controller.UpdatePointOfInterest(poi.GetId(), poi, Languages.HEBREW).Result as BadRequestObjectResult;

        Assert.IsNotNull(result);
    }
        
    [TestMethod]
    public void UpdatePointOfInterest_ValidFeature_ShouldUpdate()
    {
        _controller.SetupIdentity();
        var poi = new Feature(new Point(0, 0), new AttributesTable {
            { FeatureAttributes.POI_SOURCE, Sources.OSM },
            { FeatureAttributes.POI_ID, "1" },
            { FeatureAttributes.POI_ICON, "icon" },
        });
        poi.SetLocation(new Coordinate());

        var result = _controller.UpdatePointOfInterest(poi.GetId(), poi, Languages.HEBREW).Result as OkObjectResult;

        Assert.IsNotNull(result);
        _pointsOfInterestProvider.Received(1).UpdateFeature(Arg.Any<Feature>(), _osmGateway, Arg.Any<string>());
    }

    [TestMethod]
    public void GetClosestPoint_ShouldGetTheClosesOsmPoint()
    {
        _pointsOfInterestProvider.GetClosestPoint(Arg.Any<Coordinate>(), Arg.Any<string>(), Arg.Any<string>()).Returns(new Feature(new Point(0,0), new AttributesTable()));

        var results = _controller.GetClosestPoint("0,0", Sources.OSM, Languages.HEBREW).Result;

        Assert.IsNotNull(results);
    }
        
    [TestMethod]
    public void GetClosestPoint_NoSource_ShouldGetTheClosesPoint()
    {
        _pointsOfInterestProvider.GetClosestPoint(Arg.Any<Coordinate>(), Arg.Any<string>(), Arg.Any<string>()).Returns(new Feature(new Point(0,0), new AttributesTable()));

        var results = _controller.GetClosestPoint("0,0", null, Languages.HEBREW).Result;

        Assert.IsNotNull(results);
    }
        
    [TestMethod]
    public void CreateSimplePoint_DoesNotExistInCache_ShouldAddIt()
    {
        _controller.SetupIdentity();
        var simpleFeature = new Feature
        {
            Attributes = new AttributesTable
            {
                { FeatureAttributes.POI_ID, Guid.NewGuid().ToString() },
                { FeatureAttributes.POI_IS_SIMPLE, "true" },
                { FeatureAttributes.POI_SOURCE, Sources.OSM },
                { FeatureAttributes.POI_TYPE, SimplePointType.Parking.ToString() }
            }
        };
        simpleFeature.SetLocation(new Coordinate());

        _controller.CreatePointOfInterest(simpleFeature, Languages.HEBREW).Wait();

        _simplePointAdderExecutor.Received(1).Add(Arg.Any<IAuthClient>(), Arg.Any<AddSimplePointOfInterestRequest>());
    }

    [TestMethod]
    public void CreateSimplePoint_ExistsInCache_ShouldNotAddIt()
    {
        var guidString = Guid.NewGuid().ToString();
        _persistentCache.Get(guidString).Returns([1]);
        var simpleFeature = new Feature
        {
            Attributes = new AttributesTable
            {
                { FeatureAttributes.POI_ID, guidString },
                { FeatureAttributes.POI_IS_SIMPLE, "true" },
                { FeatureAttributes.POI_SOURCE, Sources.OSM },
                { FeatureAttributes.POI_TYPE, SimplePointType.Parking.ToString() }
            }
        };
        simpleFeature.SetLocation(new Coordinate());

        _controller.CreatePointOfInterest(simpleFeature, Languages.HEBREW).Wait();

        _simplePointAdderExecutor.DidNotReceive().Add(Arg.Any<IAuthClient>(), Arg.Any<AddSimplePointOfInterestRequest>());
    }
}