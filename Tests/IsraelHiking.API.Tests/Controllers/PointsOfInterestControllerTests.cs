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
using Microsoft.Extensions.Caching.Memory;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using Microsoft.VisualStudio.TestTools.UnitTesting;
using NetTopologySuite.Features;
using NetTopologySuite.Geometries;
using NSubstitute;
using OsmSharp.IO.API;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;

namespace IsraelHiking.API.Tests.Controllers
{
    [TestClass]
    public class PointsOfInterestControllerTests
    {
        private PointsOfInterestController _controller;
        private IAuthClient _osmGateway;
        private ITagsHelper _tagHelper;
        private IPointsOfInterestProvider _pointsOfInterestProvider;
        private IImagesUrlsStorageExecutor _imagesUrlsStorageExecutor;
        private UsersIdAndTokensCache _cache;
        private IDistributedCache _persistantCache;
        private ISimplePointAdderExecutor _simplePointAdderExecutor;

        [TestInitialize]
        public void TestInitialize()
        {
            _pointsOfInterestProvider = Substitute.For<IPointsOfInterestProvider>();
            _tagHelper = Substitute.For<ITagsHelper>();
            _osmGateway = Substitute.For<IAuthClient>();
            _imagesUrlsStorageExecutor = Substitute.For<IImagesUrlsStorageExecutor>();
            _persistantCache = Substitute.For<IDistributedCache>();
            _simplePointAdderExecutor = Substitute.For<ISimplePointAdderExecutor>();
            var optionsProvider = Substitute.For<IOptions<ConfigurationData>>();
            optionsProvider.Value.Returns(new ConfigurationData());
            _cache = new UsersIdAndTokensCache(optionsProvider, Substitute.For<ILogger>(), new MemoryCache(new MemoryCacheOptions()));
            var factory = Substitute.For<IClientsFactory>();
            factory.CreateOAuthClient(Arg.Any<string>(), Arg.Any<string>(), Arg.Any<string>(), Arg.Any<string>()).Returns(_osmGateway);
            _controller = new PointsOfInterestController(factory, 
                _tagHelper, 
                _pointsOfInterestProvider, 
                _imagesUrlsStorageExecutor,
                _simplePointAdderExecutor,
                _persistantCache,
                Substitute.For<ILogger>(),
                optionsProvider, 
                _cache);
        }

        [TestMethod]
        public void GetCategoriesByType_ShouldGetThemFromTagHelper()
        {
            var category = "category";

            _controller.GetCategoriesByGroup(category);

            _tagHelper.Received(1).GetCategoriesByGroup(category);
        }

        [TestMethod]
        public void GetPointsOfIntereset_NoCategory_ShouldReturnEmptyList()
        {
            var result = _controller.GetPointsOfInterest(string.Empty, string.Empty, string.Empty).Result;

            Assert.AreEqual(0, result.Length);
            _pointsOfInterestProvider.DidNotReceive().GetFeatures(Arg.Any<Coordinate>(), Arg.Any<Coordinate>(), Arg.Any<string[]>(), Arg.Any<string>());
        }

        [TestMethod]
        public void GetPointsOfIntereset_OneAdapter_ShouldReturnPoi()
        {
            _pointsOfInterestProvider.GetFeatures(Arg.Any<Coordinate>(), Arg.Any<Coordinate>(), Arg.Any<string[]>(),
                Arg.Any<string>()).Returns(new[] { new Feature() });

            var result = _controller.GetPointsOfInterest(string.Empty, string.Empty, "category", "language").Result;

            Assert.AreEqual(1, result.Length);
        }

        [TestMethod]
        public void GetPointOfIntereset_WrongSource_ShouldReturnBadRequest()
        {
            var result = _controller.GetPointOfInterest("wrong source", string.Empty).Result as NotFoundResult;

            Assert.IsNotNull(result);
        }

        [TestMethod]
        public void GetPointOfInteresetCoordinates_BySourceAndId_ShouldReturnIt()
        {
            var id = "32_35";
            var source = Sources.COORDINATES;
            _pointsOfInterestProvider.GetCoordinatesFeature(Arg.Any<LatLng>(), id).Returns(new Feature());

            var result = _controller.GetPointOfInterest(source, id).Result as OkObjectResult;

            Assert.IsNotNull(result);
            var poi = result.Value as Feature;
            Assert.IsNotNull(poi);
        }

        [TestMethod]
        public void GetPointOfIntereset_BySourceAndId_ShouldReturnIt()
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
            var poi = new Feature(new Point(0, 0), new AttributesTable { { FeatureAttributes.POI_SOURCE, "wrong source" } });
            
            var result = _controller.CreatePointOfInterest(poi, Languages.HEBREW).Result as BadRequestObjectResult;

            Assert.IsNotNull(result);
        }

        [TestMethod]
        public void CreatePointOfInterest_AddressTooLong_ShouldReturnBadRequest()
        {
            var poi = new Feature(new Point(0, 0), new AttributesTable
            {
                { FeatureAttributes.POI_SOURCE, Sources.OSM },
                { FeatureAttributes.WEBSITE, string.Join("", Enumerable.Repeat("i", 256)) }
            });
            
            var result = _controller.CreatePointOfInterest(poi, Languages.HEBREW).Result as BadRequestObjectResult;

            Assert.IsNotNull(result);
        }
        
        [TestMethod]
        public void CreatePointOfInterest_ExistsInCacheAndInTheDatabase_ShouldAdd()
        {
            _controller.SetupIdentity(_cache);
            var poi = new Feature(new Point(0, 0), new AttributesTable {
                { FeatureAttributes.POI_SOURCE, Sources.OSM },
                { FeatureAttributes.POI_ICON, "icon" },
                { FeatureAttributes.POI_ID, Guid.NewGuid().ToString() },
            });
            poi.SetLocation(new Coordinate());
            _persistantCache.Get(Arg.Any<string>()).Returns(Encoding.UTF8.GetBytes("the id in the cache"));
            _pointsOfInterestProvider.GetFeatureById(Sources.OSM, "the id in the cache").Returns(poi);

            var result = _controller.CreatePointOfInterest(poi, Languages.HEBREW).Result as OkObjectResult;

            Assert.IsNotNull(result);
            _pointsOfInterestProvider.DidNotReceive().AddFeature(Arg.Any<Feature>(), _osmGateway, Arg.Any<string>());
        }

        [TestMethod]
        public void CreatePointOfInterest_ExistsInCacheButNotInTheDatabase_ShouldAdd()
        {
            _controller.SetupIdentity(_cache);
            var poi = new Feature(new Point(0, 0), new AttributesTable {
                { FeatureAttributes.POI_SOURCE, Sources.OSM },
                { FeatureAttributes.POI_ICON, "icon" },
                { FeatureAttributes.POI_ID, Guid.NewGuid().ToString() },
            });
            poi.SetLocation(new Coordinate());
            _persistantCache.Get(Arg.Any<string>()).Returns(Encoding.UTF8.GetBytes("the id in the cache"));
            _pointsOfInterestProvider.GetFeatureById(Sources.OSM, "the id in the cache").Returns((Feature)null);

            var result = _controller.CreatePointOfInterest(poi, Languages.HEBREW).Result as BadRequestObjectResult;

            Assert.IsNotNull(result);
            _pointsOfInterestProvider.DidNotReceive().AddFeature(Arg.Any<Feature>(), _osmGateway, Arg.Any<string>());
        }

        [TestMethod]
        public void CreatePointOfInterest_DoesNotExistInCache_ShouldNotAdd()
        {
            _controller.SetupIdentity(_cache);
            var poi = new Feature(new Point(0, 0), new AttributesTable {
                { FeatureAttributes.POI_SOURCE, Sources.OSM },
                { FeatureAttributes.POI_ICON, "icon" },
                { FeatureAttributes.POI_ID, Guid.NewGuid().ToString() },
            });
            poi.SetLocation(new Coordinate(0, 0));
            _persistantCache.Get(Arg.Any<string>()).Returns((byte[])null);
            _pointsOfInterestProvider.AddFeature(poi, _osmGateway, Languages.HEBREW).Returns(new Feature(new Point(0,0), new AttributesTable
            {
                { FeatureAttributes.ID, "new id" }
            }));

            var result = _controller.CreatePointOfInterest(poi, Languages.HEBREW).Result as OkObjectResult;

            Assert.IsNotNull(result);
            Assert.IsTrue((result.Value as Feature).Attributes.Exists(FeatureAttributes.ID));
        }

        [TestMethod]
        public void UploadPointOfInterest_IncorrectId_ShouldNotUpdate()
        {
            _controller.SetupIdentity(_cache);
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
            _controller.SetupIdentity(_cache);
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
        public void UpdatePointOfInterest_ValidFeature_ShouldUpdate()
        {
            _controller.SetupIdentity(_cache);
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

            var results = _controller.GetClosestPoint("0,0", Sources.OSM, "he").Result;

            Assert.IsNotNull(results);
        }

        [TestMethod]
        public void CreateSimplePoint_DoesNotExistInCache_ShouldAddIt()
        {
            _controller.SetupIdentity(_cache);
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
            _persistantCache.Get(guidString).Returns(new byte[] { 1 });
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
}
