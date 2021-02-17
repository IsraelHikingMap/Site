using IsraelHiking.API.Controllers;
using IsraelHiking.API.Converters;
using IsraelHiking.API.Executors;
using IsraelHiking.API.Services;
using IsraelHiking.API.Services.Poi;
using IsraelHiking.Common;
using IsraelHiking.Common.Configuration;
using IsraelHiking.Common.Extensions;
using IsraelHiking.DataAccessInterfaces;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Caching.Memory;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using Microsoft.VisualStudio.TestTools.UnitTesting;
using NetTopologySuite.Features;
using NetTopologySuite.Geometries;
using NSubstitute;
using OsmSharp.API;
using OsmSharp.IO.API;
using System.IO;
using System.Security.Cryptography;

namespace IsraelHiking.API.Tests.Controllers
{
    [TestClass]
    public class PointsOfInterestControllerTests
    {
        private PointsOfInterestController _controller;
        private IWikimediaCommonGateway _wikimediaCommonGateway;
        private IAuthClient _osmGateway;
        private ITagsHelper _tagHelper;
        private IPointsOfInterestProvider _pointsOfInterestProvider;
        private IImagesUrlsStorageExecutor _imagesUrlsStorageExecutor;
        private UsersIdAndTokensCache _cache;

        [TestInitialize]
        public void TestInitialize()
        {
            _pointsOfInterestProvider = Substitute.For<IPointsOfInterestProvider>();
            _tagHelper = Substitute.For<ITagsHelper>();
            _wikimediaCommonGateway = Substitute.For<IWikimediaCommonGateway>();
            _osmGateway = Substitute.For<IAuthClient>();
            _imagesUrlsStorageExecutor = Substitute.For<IImagesUrlsStorageExecutor>();
            var optionsProvider = Substitute.For<IOptions<ConfigurationData>>();
            optionsProvider.Value.Returns(new ConfigurationData());
            _cache = new UsersIdAndTokensCache(optionsProvider, Substitute.For<ILogger>(), new MemoryCache(new MemoryCacheOptions()));
            var factory = Substitute.For<IClientsFactory>();
            factory.CreateOAuthClient(Arg.Any<string>(), Arg.Any<string>(), Arg.Any<string>(), Arg.Any<string>()).Returns(_osmGateway);
            _controller = new PointsOfInterestController(factory, 
                _tagHelper, 
                _wikimediaCommonGateway, 
                _pointsOfInterestProvider, 
                new Base64ImageStringToFileConverter(), 
                _imagesUrlsStorageExecutor,
                Substitute.For<ISimplePointAdderExecutor>(),
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
            _pointsOfInterestProvider.DidNotReceive().GetPointsOfInterest(Arg.Any<Coordinate>(), Arg.Any<Coordinate>(), Arg.Any<string[]>(), Arg.Any<string>());
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
            var result = _controller.GetPointOfInterest("wrong source", string.Empty, "language").Result as NotFoundResult;

            Assert.IsNotNull(result);
        }

        [TestMethod]
        public void GetPointOfInteresetCoordinates_BySourceAndId_ShouldReturnIt()
        {
            var id = "32_35";
            var source = Sources.COORDINATES;
            var language = "language";

            var result = _controller.GetPointOfInterest(source, id, language).Result as OkObjectResult;

            Assert.IsNotNull(result);
            var poi = result.Value as Feature;
            Assert.IsNotNull(poi);
            Assert.AreEqual(32, poi.GetLocation().Y);
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
        public void UploadPointOfInterest_WrongSource_ShouldReturnBadRequest()
        {
            var poi = new Feature(new Point(0, 0), new AttributesTable { { FeatureAttributes.POI_SOURCE, "wrong source" } });
            
            var result = _controller.UploadPointOfInterest(poi, Languages.HEBREW).Result as BadRequestObjectResult;

            Assert.IsNotNull(result);
        }

        [TestMethod]
        public void UploadPointOfInterest_IdDoesNotExists_ShouldAdd()
        {
            _controller.SetupIdentity(_cache);
            var poi = new Feature(new Point(0, 0), new AttributesTable {
                { FeatureAttributes.POI_SOURCE, Sources.OSM },
                { FeatureAttributes.POI_ICON, "icon" },
            });
            poi.SetLocation(new Coordinate());

            var result = _controller.UploadPointOfInterest(poi, Languages.HEBREW).Result as OkObjectResult;

            Assert.IsNotNull(result);
            _pointsOfInterestProvider.Received(1).AddFeature(Arg.Any<Feature>(), _osmGateway, Arg.Any<string>());
        }

        [TestMethod]
        public void UploadPointOfInterest_IdExists_ShouldUpdate()
        {
            _controller.SetupIdentity(_cache);
            var poi = new Feature(new Point(0, 0), new AttributesTable {
                { FeatureAttributes.POI_SOURCE, Sources.OSM },
                { FeatureAttributes.POI_ID, "1" },
                { FeatureAttributes.POI_ICON, "icon" },
            });
            poi.SetLocation(new Coordinate());

            var result = _controller.UploadPointOfInterest(poi, Languages.HEBREW).Result as OkObjectResult;

            Assert.IsNotNull(result);
            _pointsOfInterestProvider.Received(1).UpdateFeature(Arg.Any<Feature>(), _osmGateway, Arg.Any<string>());
        }

        [TestMethod]
        public void UploadPointOfInterest_WithImageIdExists_ShouldUpdate()
        {
            var user = new User {DisplayName = "DisplayName"};
            _controller.SetupIdentity(_cache);
            _osmGateway.GetUserDetails().Returns(user);
            var poi = new Feature(new Point(0, 0), new AttributesTable {
                { FeatureAttributes.NAME, "title" },
                { "name:he", "title" },
                { FeatureAttributes.POI_SOURCE, Sources.OSM },
                { FeatureAttributes.POI_ID, "1" },
                { FeatureAttributes.POI_ICON, "icon" },
                { FeatureAttributes.IMAGE_URL, "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAUAAAAFCAYAAACNbyblAAAAHElEQVQI12P4//" +
                                      "8/w38GIAXDIBKE0DHxgljNBAAO9TXL0Y4OHwAAAABJRU5ErkJggg=="},
                { "image2", "http://link.com" }
            });
            poi.SetLocation(new Coordinate(6, 5));
            _imagesUrlsStorageExecutor.GetImageUrlIfExists(Arg.Any<MD5>(), Arg.Any<byte[]>()).Returns((string)null);

            _controller.UploadPointOfInterest(poi, Languages.HEBREW).Wait();

            _wikimediaCommonGateway.Received(1).UploadImage(poi.GetTitle(Languages.HEBREW), poi.GetDescription(Languages.HEBREW), user.DisplayName, "title.png", Arg.Any<Stream>(), Arg.Any<Coordinate>());
            _wikimediaCommonGateway.Received(1).GetImageUrl(Arg.Any<string>());
            _imagesUrlsStorageExecutor.Received(1).StoreImage(Arg.Any<MD5>(), Arg.Any<byte[]>(), Arg.Any<string>());
        }

        [TestMethod]
        public void UploadPointOfInterest_WithImageInRepository_ShouldNotUploadImage()
        {
            var user = new User { DisplayName = "DisplayName" };
            _controller.SetupIdentity(_cache);
            _osmGateway.GetUserDetails().Returns(user);
            var poi = new Feature(new Point(0, 0), new AttributesTable {
                { FeatureAttributes.NAME, "title" },
                { FeatureAttributes.POI_SOURCE, Sources.OSM },
                { FeatureAttributes.ID, "1" },
                { FeatureAttributes.POI_ICON, "icon" },
                { FeatureAttributes.IMAGE_URL, "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAUAAAAFCAYAAACNbyblAAAAHElEQVQI12P4//" +
                                      "8/w38GIAXDIBKE0DHxgljNBAAO9TXL0Y4OHwAAAABJRU5ErkJggg=="},
                { "image2", "http://link.com" }
            });
            poi.SetLocation(new Coordinate(6, 5));
            _imagesUrlsStorageExecutor.GetImageUrlIfExists(Arg.Any<MD5>(), Arg.Any<byte[]>()).Returns("some-url");

            _controller.UploadPointOfInterest(poi, Languages.HEBREW).Wait();

            _wikimediaCommonGateway.DidNotReceive().UploadImage(Arg.Any<string>(), Arg.Any<string>(), Arg.Any<string>(), Arg.Any<string>(), Arg.Any<Stream>(), Arg.Any<Coordinate>());
            _wikimediaCommonGateway.DidNotReceive().GetImageUrl(Arg.Any<string>());
        }

        [TestMethod]
        public void GetClosestPoint_ShouldGetTheClosesOsmPoint()
        {
            _pointsOfInterestProvider.GetClosestPoint(Arg.Any<Coordinate>(), Arg.Any<string>(), Arg.Any<string>()).Returns(new Feature(new Point(0,0), new AttributesTable()));

            var results = _controller.GetClosestPoint("0,0", Sources.OSM, "he").Result;

            Assert.IsNotNull(results);
        }
    }
}
