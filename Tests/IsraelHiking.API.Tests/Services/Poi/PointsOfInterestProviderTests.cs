using System;
using IsraelHiking.API.Converters;
using IsraelHiking.API.Executors;
using IsraelHiking.API.Services;
using IsraelHiking.API.Services.Poi;
using IsraelHiking.Common;
using IsraelHiking.Common.Extensions;
using IsraelHiking.DataAccessInterfaces;
using IsraelHiking.DataAccessInterfaces.Repositories;
using Microsoft.Extensions.Logging;
using Microsoft.VisualStudio.TestTools.UnitTesting;
using NetTopologySuite.Features;
using NetTopologySuite.Geometries;
using NSubstitute;
using OsmSharp;
using OsmSharp.API;
using OsmSharp.Complete;
using OsmSharp.IO.API;
using OsmSharp.Tags;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Security.Cryptography;

namespace IsraelHiking.API.Tests.Services.Poi
{
    [TestClass]
    public class PointsOfInterestProviderTests : BasePointsOfInterestAdapterTestsHelper
    {
        private PointsOfInterestProvider _adapter;
        private IClientsFactory _clientsFactory;
        private IOsmGeoJsonPreprocessorExecutor _osmGeoJsonPreprocessorExecutor;
        private IOsmRepository _osmRepository;
        private IPointsOfInterestRepository _pointsOfInterestRepository;
        private IWikimediaCommonGateway _wikimediaCommonGateway;
        private IOsmLatestFileGateway _latestFileGateway;
        private IImagesUrlsStorageExecutor _imagesUrlsStorageExecutor;
        private ITagsHelper _tagsHelper;

        [TestInitialize]
        public void TestInitialize()
        {
            InitializeSubstitutes();
            _clientsFactory = Substitute.For<IClientsFactory>();
            _tagsHelper = new TagsHelper(_options);
            _osmGeoJsonPreprocessorExecutor = new OsmGeoJsonPreprocessorExecutor(Substitute.For<ILogger>(),
                ElevationGateway, 
                new ItmWgs84MathTransfromFactory(),
                new OsmGeoJsonConverter(new GeometryFactory()), _tagsHelper);
            _osmRepository = Substitute.For<IOsmRepository>();
            _latestFileGateway = Substitute.For<IOsmLatestFileGateway>();
            _pointsOfInterestRepository = Substitute.For<IPointsOfInterestRepository>();
            _imagesUrlsStorageExecutor = Substitute.For<IImagesUrlsStorageExecutor>();
            _wikimediaCommonGateway = Substitute.For<IWikimediaCommonGateway>();
            _adapter = new PointsOfInterestProvider(_pointsOfInterestRepository,
                ElevationGateway,
                _osmGeoJsonPreprocessorExecutor,
                _osmRepository,
                _itmWgs84MathTransfromFactory,
                _latestFileGateway,
                _wikimediaCommonGateway,
                new Base64ImageStringToFileConverter(),
                _imagesUrlsStorageExecutor,
                _tagsHelper,
                _options,
                Substitute.For<ILogger>());
        }

        private IAuthClient SetupHttpFactory()
        {
            var gateway = Substitute.For<IAuthClient>();
            _clientsFactory.CreateOAuthClient(Arg.Any<string>(), Arg.Any<string>(), Arg.Any<string>(), Arg.Any<string>()).Returns(gateway);
            return gateway;
        }

        [TestMethod]
        public void GetFeature_FilterRelevant_ShouldReturnEmptyList()
        {
            var feature = new Feature
            {
                Geometry = new Point(null),
                Attributes = new AttributesTable { { FeatureAttributes.POI_ID, "42" } }
            };
            feature.SetLocation(new Coordinate(0, 0));
            _pointsOfInterestRepository.GetPointsOfInterest(null, null, null, null).Returns(new List<Feature> { feature });

            var results = _adapter.GetFeatures(null, null, null, null).Result;

            Assert.AreEqual(0, results.Length);
        }

        [TestMethod]
        public void GetFeature_EnglishTitleOnly_ShouldReturnIt()
        {
            var name = "English name";
            var feature = GetValidFeature("poiId", Sources.OSM);
            feature.Attributes.DeleteAttribute(FeatureAttributes.NAME);
            feature.Attributes.Add("name:en", name);
            _pointsOfInterestRepository.GetPointsOfInterest(null, null, null, "en").Returns(new List<Feature> { feature });

            var result = _adapter.GetFeatures(null, null, null, "en").Result;

            Assert.AreEqual(1, result.Length);
            result.First().SetTitles();
            Assert.AreEqual(name, result.First().GetTitle("en"));
        }

        [TestMethod]
        public void GetFeature_ImageAndDescriptionOnly_ShouldReturnIt()
        {
            var feature = GetValidFeature("poiId", Sources.OSM);
            feature.Attributes.DeleteAttribute(FeatureAttributes.NAME);
            feature.Attributes.Add(FeatureAttributes.IMAGE_URL, FeatureAttributes.IMAGE_URL);
            feature.Attributes.Add(FeatureAttributes.WIKIPEDIA, FeatureAttributes.DESCRIPTION);
            _pointsOfInterestRepository.GetPointsOfInterest(null, null, null, "he").Returns(new List<Feature> { feature });

            var result = _adapter.GetFeatures(null, null, null, "he").Result;

            Assert.AreEqual(1, result.Length);
            Assert.AreEqual(string.Empty, result.First().GetTitle("he"));
        }

        [TestMethod]
        public void GetFeature_NoIcon_ShouldReturnItWithSearchIcon()
        {
            var feature = GetValidFeature("poiId", Sources.OSM);
            feature.Attributes.AddOrUpdate(FeatureAttributes.POI_ICON, string.Empty);
            _pointsOfInterestRepository.GetPointsOfInterest(null, null, null, "he").Returns(new List<Feature> { feature });

            var result = _adapter.GetFeatures(null, null, null, "he").Result;

            Assert.AreEqual(1, result.Length);
            Assert.AreEqual(PointsOfInterestProvider.SEARCH_ICON, result.First().Attributes[FeatureAttributes.POI_ICON]);
        }

        [TestMethod]
        public void GetFeatureById_RouteWithMultipleAttributes_ShouldReturnIt()
        {
            var poiId = "poiId";
            var feature = GetValidFeature(poiId, Sources.OSM);
            feature.Attributes.DeleteAttribute(FeatureAttributes.NAME);
            feature.Attributes.Add(FeatureAttributes.IMAGE_URL, FeatureAttributes.IMAGE_URL);
            feature.Attributes.Add(FeatureAttributes.IMAGE_URL + "1", FeatureAttributes.IMAGE_URL + "1");
            feature.Attributes.Add(FeatureAttributes.DESCRIPTION, FeatureAttributes.DESCRIPTION);
            feature.Attributes.Add(FeatureAttributes.WIKIPEDIA + ":en", "page with space");
            _pointsOfInterestRepository.GetPointOfInterestById(poiId, Sources.OSM).Returns(feature);

            var result = _adapter.GetFeatureById(Sources.OSM, poiId).Result;

            Assert.IsNotNull(result);
            Assert.AreEqual(string.Empty, result.GetTitle("en"));
            Assert.AreEqual(FeatureAttributes.DESCRIPTION, result.GetDescription("en"));
            var imagesUrls = result.Attributes.GetNames()
                    .Where(n => n.StartsWith(FeatureAttributes.IMAGE_URL))
                    .Select(p => feature.Attributes[p].ToString())
                    .ToArray();
            Assert.AreEqual(2, imagesUrls.Length);
            Assert.AreEqual(FeatureAttributes.IMAGE_URL, imagesUrls.First());
            Assert.IsTrue(result.Attributes[FeatureAttributes.WIKIPEDIA + ":en"].ToString()?.Contains("page with space"));
        }

        [TestMethod]
        public void GetFeatureById_NonValidWikiTag_ShouldReturnIt()
        {
            var poiId = "poiId";
            var feature = GetValidFeature(poiId, Sources.OSM);
            feature.Attributes.Add(FeatureAttributes.WIKIPEDIA, "en:en:page");
            feature.Attributes.Add(FeatureAttributes.WEBSITE, "website");
            _pointsOfInterestRepository.GetPointOfInterestById(poiId, Sources.OSM).Returns(feature);

            var result = _adapter.GetFeatureById(Sources.OSM, poiId).Result;

            Assert.IsNotNull(result);
            Assert.AreEqual("website", result.Attributes[FeatureAttributes.WEBSITE]);
        }
        
        [TestMethod]
        public void GetFeatureById_NoIcon_ShouldReturnItWithSearchIcon()
        {
            var poiId = "poiId";
            var feature = GetValidFeature(poiId, Sources.OSM);
            feature.Attributes.AddOrUpdate(FeatureAttributes.POI_ICON, string.Empty);
            _pointsOfInterestRepository.GetPointOfInterestById(poiId, Sources.OSM).Returns(feature);

            var result = _adapter.GetFeatureById(Sources.OSM, poiId).Result;

            Assert.IsNotNull(result);
            Assert.AreEqual(PointsOfInterestProvider.SEARCH_ICON, result.Attributes[FeatureAttributes.POI_ICON]);
        }

        [TestMethod]
        public void GetFeatureById_WithMultipleWebsiteAndSourceImages_ShouldNotFail()
        {
            var poiId = "poiId";
            var feature = GetValidFeature(poiId, Sources.OSM);
            feature.Attributes.Add(FeatureAttributes.WEBSITE, "website");
            feature.Attributes.Add(FeatureAttributes.POI_SOURCE_IMAGE_URL, "sourceImage");
            feature.Attributes.Add(FeatureAttributes.WEBSITE + "1", "website1");
            feature.Attributes.Add(FeatureAttributes.POI_SOURCE_IMAGE_URL + "1", "sourceImage1");
            feature.Attributes.Add(FeatureAttributes.WEBSITE + "2", "website2");
            _pointsOfInterestRepository.GetPointOfInterestById(poiId, Sources.OSM).Returns(feature);

            var result = _adapter.GetFeatureById(Sources.OSM, poiId).Result;

            Assert.IsNotNull(result);
            var references = result.Attributes.GetNames()
                    .Where(n => n.StartsWith(FeatureAttributes.POI_SOURCE_IMAGE_URL))
                    .Select(n => result.Attributes[n])
                    .ToArray();
            Assert.AreEqual(2, references.Length);
            Assert.AreEqual("sourceImage", references.First());
            Assert.AreEqual("sourceImage1", references.Last());
        }

        [TestMethod]
        public void AddFeature_ShouldUpdateOsmAndElasticSearch()
        {
            var user = new User { DisplayName = "DisplayName" };
            var gateway = SetupHttpFactory();
            gateway.GetUserDetails().Returns(user);
            var language = "he";
            gateway.CreateElement(Arg.Any<long>(), Arg.Any<Node>()).Returns(42);
            var feature = GetValidFeature("42", Sources.OSM);
            feature.Attributes.AddOrUpdate(FeatureAttributes.IMAGE_URL, "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAUAAAAFCAYAAACNbyblAAAAHElEQVQI12P4//" +
                                      "8/w38GIAXDIBKE0DHxgljNBAAO9TXL0Y4OHwAAAABJRU5ErkJggg==");
            feature.Attributes.AddOrUpdate(FeatureAttributes.POI_ICON, _tagsHelper.GetCategoriesByGroup(Categories.POINTS_OF_INTEREST).First().Icon);
            feature.Attributes.AddOrUpdate(FeatureAttributes.WEBSITE, "he.wikipedia.org/wiki/%D7%AA%D7%9C_%D7%A9%D7%9C%D7%9D");
            _imagesUrlsStorageExecutor.GetImageUrlIfExists(Arg.Any<MD5>(), Arg.Any<byte[]>()).Returns((string)null);

            var results = _adapter.AddFeature(feature, gateway, language).Result;

            Assert.IsNotNull(results);
            _pointsOfInterestRepository.Received(1).UpdatePointsOfInterestData(Arg.Any<List<Feature>>());
            gateway.Received().CreateElement(Arg.Any<long>(), Arg.Is<OsmGeo>(x => x.Tags[FeatureAttributes.WIKIPEDIA + ":" + language].Contains("תל שלם")));
        }

        [TestMethod]
        public void AddFeature_WikipediaMobileLink_ShouldUpdateOsmAndElasticSearch()
        {
            var gateway = SetupHttpFactory();
            var language = "he";
            gateway.CreateElement(Arg.Any<long>(), Arg.Any<Node>()).Returns(42);
            var feature = GetValidFeature("42", Sources.OSM);
            feature.Attributes.AddOrUpdate(FeatureAttributes.POI_ICON, _tagsHelper.GetCategoriesByGroup(Categories.POINTS_OF_INTEREST).First().Icon);
            feature.Attributes.AddOrUpdate(FeatureAttributes.WEBSITE, "https://he.m.wikipedia.org/wiki/%D7%96%D7%95%D7%94%D7%A8_(%D7%9E%D7%95%D7%A9%D7%91)");            
            
            var results = _adapter.AddFeature(feature, gateway, language).Result;

            Assert.IsNotNull(results);
            _pointsOfInterestRepository.Received(1).UpdatePointsOfInterestData(Arg.Any<List<Feature>>());
            gateway.Received().CreateElement(Arg.Any<long>(), Arg.Is<OsmGeo>(x => x.Tags[FeatureAttributes.WIKIPEDIA + ":" + language].Contains("זוהר")));
        }

        [TestMethod]
        public void UpdateFeature_CreateWikipediaTag()
        {
            var gateway = SetupHttpFactory();
            var feature = GetValidFeature("Node_1", Sources.OSM);
            feature.Attributes.AddOrUpdate(FeatureAttributes.POI_ICON, "oldIcon");
            feature.Attributes.AddOrUpdate(FeatureAttributes.POI_ADDED_URLS, new[] { "https://en.wikipedia.org/wiki/Literary_Hall" });
            _pointsOfInterestRepository.GetPointOfInterestById(Arg.Any<string>(), Arg.Any<string>()).Returns(GetValidFeature("Node_1", Sources.OSM));
            gateway.GetNode(1).Returns(new Node
            {
                Id = 1,
                Tags = new TagsCollection
                {
                    { FeatureAttributes.DESCRIPTION, "description" }
                },
                Latitude = 0,
                Longitude = 0
            });
            
            _adapter.UpdateFeature(feature, gateway, "en").Wait();

            gateway.Received().UpdateElement(Arg.Any<long>(), Arg.Is<ICompleteOsmGeo>(x => x.Tags.ContainsKey(FeatureAttributes.WIKIPEDIA + ":en") && x.Tags.Contains(FeatureAttributes.WIKIPEDIA, "en:Literary Hall")));
        }

        [TestMethod]
        public void UpdateFeature_HasLanguageSpecificDescription_ShouldUpdateBoth()
        {
            var gateway = SetupHttpFactory();
            var feature = GetValidFeature("Node_1", Sources.OSM);
            feature.Attributes.AddOrUpdate(FeatureAttributes.POI_ICON, "oldIcon");
            feature.Attributes.AddOrUpdate(FeatureAttributes.DESCRIPTION, "new description");
            _pointsOfInterestRepository.GetPointOfInterestById(Arg.Any<string>(), Arg.Any<string>()).Returns(GetValidFeature("Node_1", Sources.OSM));
            gateway.GetNode(1).Returns(new Node
            {
                Id = 1,
                Tags = new TagsCollection
                {
                    { FeatureAttributes.DESCRIPTION + ":en", "description" },
                    { FeatureAttributes.DESCRIPTION, "description" }
                },
                Latitude = 0,
                Longitude = 0
            });
            
            _adapter.UpdateFeature(feature, gateway, "en").Wait();

            gateway.Received().UpdateElement(Arg.Any<long>(),
                Arg.Is<ICompleteOsmGeo>(x =>
                    x.Tags.GetValue(FeatureAttributes.DESCRIPTION + ":en") == "new description" &&
                    x.Tags.GetValue(FeatureAttributes.DESCRIPTION) == "new description"));
        }
        
        [TestMethod]
        public void UpdateFeature_UpdateLocationToALocationTooClose_ShouldNotUpdate()
        {
            var gateway = SetupHttpFactory();
            var feature = GetValidFeature("Node_1", Sources.OSM);
            feature.SetLocation(new Coordinate(1.00000000001,1));
            _pointsOfInterestRepository.GetPointOfInterestById(Arg.Any<string>(), Arg.Any<string>()).Returns(GetValidFeature("Node_1", Sources.OSM));
            gateway.GetNode(1).Returns(new Node
            {
                Id = 1,
                Tags = new TagsCollection
                {
                    {FeatureAttributes.NAME, "name"},
                    {FeatureAttributes.NAME + ":en", "name"}
                },
                Latitude = 1,
                Longitude = 1
            });
            
            _adapter.UpdateFeature(feature, gateway, "en").Wait();

            gateway.DidNotReceive().UpdateElement(Arg.Any<long>(), Arg.Any<ICompleteOsmGeo>());
        }
        
        [TestMethod]
        public void UpdateFeature_UpdateLocationOfWay_ShouldNotUpdate()
        {
            var gateway = SetupHttpFactory();
            var feature = GetValidFeature("Way_1", Sources.OSM);
            feature.SetLocation(new Coordinate(1,1));
            _pointsOfInterestRepository.GetPointOfInterestById(Arg.Any<string>(), Arg.Any<string>()).Returns(GetValidFeature("Node_1", Sources.OSM));
            gateway.GetCompleteWay(1).Returns(new CompleteWay
            {
                Id = 1,
                Tags = new TagsCollection
                {
                    {FeatureAttributes.NAME, "name"},
                    {FeatureAttributes.NAME + ":en", "name"}
                },
                Nodes = new []
                {
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
                    },
                } 
            });
            
            _adapter.UpdateFeature(feature, gateway, "en").Wait();

            gateway.DidNotReceive().UpdateElement(Arg.Any<long>(), Arg.Any<ICompleteOsmGeo>());
        }
        
        [TestMethod]
        public void GetPointsForIndexing_ShouldGetThem()
        {
            _latestFileGateway.Get().Returns(new MemoryStream());
            _osmRepository.GetElementsWithName(Arg.Any<Stream>()).Returns(new List<ICompleteOsmGeo>());
            _osmRepository.GetPointsWithNoNameByTags(Arg.Any<Stream>(), Arg.Any<List<KeyValuePair<string, string>>>())
                .Returns(new List<Node>());

            var results = _adapter.GetAll().Result;

            Assert.AreEqual(0, results.Count);
        }

        [TestMethod]
        public void GetClosestPoint_ShouldGetTheClosesOsmPoint()
        {
            var list = new List<Feature>
            {
                new Feature(new LineString(Array.Empty<Coordinate>()), new AttributesTable
                {
                    {FeatureAttributes.POI_SOURCE, Sources.OSM}
                }),
                new Feature(new Point(new Coordinate(0, 0)), new AttributesTable
                {
                    {FeatureAttributes.POI_SOURCE, Sources.WIKIPEDIA}
                }),
                new Feature(new Point(new Coordinate(0.01, 0.01)), new AttributesTable
                {
                    {FeatureAttributes.POI_SOURCE, Sources.OSM}
                })
            };
            _pointsOfInterestRepository.GetPointsOfInterest(Arg.Any<Coordinate>(), Arg.Any<Coordinate>(), Arg.Any<string[]>(), Arg.Any<string>()).Returns(list);

            var results = _adapter.GetClosestPoint(new Coordinate(0,0), Sources.OSM).Result;

            Assert.AreEqual(list.Last(), results);
        }

        [TestMethod]
        public void GetUpdates_TooOld_ShouldThrow()
        {
            Assert.ThrowsException<AggregateException>(() => _adapter.GetUpdates(DateTime.MinValue, DateTime.Now).Result);
        }
        
        [TestMethod]
        public void GetUpdates_ShouldReturnThem()
        {
            _pointsOfInterestRepository.GetPointsOfInterestUpdates(Arg.Any<DateTime>(), Arg.Any<DateTime>())
                .Returns(new List<Feature>());
            _pointsOfInterestRepository.GetLastSuccessfulRebuildTime().Returns(DateTime.Now);
            
            var results = _adapter.GetUpdates(DateTime.Now, DateTime.Now).Result;
            
            Assert.AreEqual(0, results.Features.Length);
        }
        
        [TestMethod]
        public void UpdateFeature_WithImageIdExists_ShouldUpdate()
        {
            var user = new User { DisplayName = "DisplayName" };
            var gateway = SetupHttpFactory();
            gateway.GetUserDetails().Returns(user);
            const string id = "Node_42";
            var poi = new Feature(new Point(0, 0), new AttributesTable {
                { FeatureAttributes.POI_SOURCE, Sources.OSM },
                { FeatureAttributes.ID, id },
                { FeatureAttributes.POI_ICON, "icon" },
                { FeatureAttributes.POI_ADDED_IMAGES, new [] {"data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAUAAAAFCAYAAACNbyblAAAAHElEQVQI12P4//" +
                                      "8/w38GIAXDIBKE0DHxgljNBAAO9TXL0Y4OHwAAAABJRU5ErkJggg=="} }
            });
            _imagesUrlsStorageExecutor.GetImageUrlIfExists(Arg.Any<MD5>(), Arg.Any<byte[]>()).Returns((string)null);
            var featureFromDatabase = new Feature
            {
                Attributes = new AttributesTable
                {
                    { FeatureAttributes.POI_ICON, "icon" }
                }
            };
            _pointsOfInterestRepository.GetPointOfInterestById(id, Sources.OSM).Returns(featureFromDatabase);
            gateway.GetNode(42).Returns(new Node { Tags = new TagsCollection {
                { "description:he", "description" },
                { "name:he", "name" },
            }, Latitude = 0, Longitude = 0, Id = 42 });

            _adapter.UpdateFeature(poi, gateway, Languages.HEBREW).Wait();

            _wikimediaCommonGateway.Received(1).UploadImage("name", "description", user.DisplayName, "name.png", Arg.Any<Stream>(), Arg.Any<Coordinate>());
            _wikimediaCommonGateway.Received(1).GetImageUrl(Arg.Any<string>());
            _imagesUrlsStorageExecutor.Received(1).StoreImage(Arg.Any<MD5>(), Arg.Any<byte[]>(), Arg.Any<string>());
        }

        [TestMethod]
        public void UpdateFeature_WithImageInRepository_ShouldNotUploadImage()
        {
            var user = new User { DisplayName = "DisplayName" };
            var gateway = SetupHttpFactory();
            gateway.GetUserDetails().Returns(user);
            var id = "Node_42";
            var poi = new Feature(new Point(0, 0), new AttributesTable {
                { FeatureAttributes.POI_SOURCE, Sources.OSM },
                { FeatureAttributes.ID, id },
                { FeatureAttributes.POI_ICON, "icon" },
                { FeatureAttributes.POI_ADDED_IMAGES, new [] {"data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAUAAAAFCAYAAACNbyblAAAAHElEQVQI12P4//" +
                                      "8/w38GIAXDIBKE0DHxgljNBAAO9TXL0Y4OHwAAAABJRU5ErkJggg=="} }
            });
            _imagesUrlsStorageExecutor.GetImageUrlIfExists(Arg.Any<MD5>(), Arg.Any<byte[]>()).Returns("some-url");
            _pointsOfInterestRepository.GetPointOfInterestById(id, Sources.OSM).Returns(new Feature
            {
                Attributes = new AttributesTable
                {
                    { FeatureAttributes.POI_ICON, "icon" }
                }
            });
            gateway.GetNode(42).Returns(new Node { Tags = new TagsCollection { { "osmish", "something" } }, Latitude = 0, Longitude = 0, Id = 42 });

            _adapter.UpdateFeature(poi, gateway, Languages.HEBREW).Wait();

            _wikimediaCommonGateway.DidNotReceive().UploadImage(Arg.Any<string>(), Arg.Any<string>(), Arg.Any<string>(), Arg.Any<string>(), Arg.Any<Stream>(), Arg.Any<Coordinate>());
            _wikimediaCommonGateway.DidNotReceive().GetImageUrl(Arg.Any<string>());
            gateway.Received().UpdateElement(Arg.Any<long>(), Arg.Is<ICompleteOsmGeo>(o => o.Tags.Any(t => t.Key == "image")));
        }

        [TestMethod]
        public void UpdateFeature_NewTitleDescriptionUrlsLocation_ShouldUpdateInOSM()
        {
            var user = new User { DisplayName = "DisplayName" };
            var gateway = SetupHttpFactory();
            gateway.GetUserDetails().Returns(user);
            const string id = "Node_42";
            var poi = new Feature(new Point(0, 0), new AttributesTable {
                { FeatureAttributes.POI_SOURCE, Sources.OSM },
                { FeatureAttributes.ID, id },
                { FeatureAttributes.POI_ICON, "icon" },
                { FeatureAttributes.POI_ADDED_URLS, new [] { "some-url" } }
            });
            poi.Attributes.AddOrUpdate(FeatureAttributes.NAME + ":" + Languages.HEBREW, "new name");
            poi.Attributes.AddOrUpdate(FeatureAttributes.DESCRIPTION + ":" + Languages.HEBREW, "new description");
            poi.SetLocation(new Coordinate(6, 5));
            _pointsOfInterestRepository.GetPointOfInterestById(id, Sources.OSM).Returns(new Feature
            {
                Attributes = new AttributesTable
                {
                    { FeatureAttributes.POI_ICON, "icon" }
                }
            });
            gateway.GetNode(42).Returns(new Node { Tags = new TagsCollection { { "osmish", "something" } }, Latitude = 0, Longitude = 0, Id = 42 });

            _adapter.UpdateFeature(poi, gateway, Languages.HEBREW).Wait();

            _wikimediaCommonGateway.DidNotReceive().UploadImage(Arg.Any<string>(), Arg.Any<string>(), Arg.Any<string>(), Arg.Any<string>(), Arg.Any<Stream>(), Arg.Any<Coordinate>());
            _wikimediaCommonGateway.DidNotReceive().GetImageUrl(Arg.Any<string>());
            gateway.Received().UpdateElement(Arg.Any<long>(), Arg.Is<ICompleteOsmGeo>(o => o.Tags.Any(t =>
                t.Key == "description:he" && t.Value == "new description") &&
                o.Tags.Any(t => t.Key == "name:he" && t.Value == "new name") &&
                o.Tags.Any(t => t.Key == "website" && t.Value == "some-url") &&
                (o as Node).Latitude.Value == 5 && (o as Node).Longitude.Value == 6
             ));
        }

        [TestMethod]
        public void UpdateFeature_UpdateSameUrlsSecondTime_ShouldNotUpdate()
        {
            var user = new User { DisplayName = "DisplayName" };
            var gateway = SetupHttpFactory();
            gateway.GetUserDetails().Returns(user);
            const string id = "Node_42";
            var poi = new Feature(new Point(0, 0), new AttributesTable {
                { FeatureAttributes.POI_SOURCE, Sources.OSM },
                { FeatureAttributes.ID, id },
                { FeatureAttributes.POI_ICON, "icon" },
                { FeatureAttributes.POI_ADDED_URLS, new [] { "some-url" } }
            });
            _pointsOfInterestRepository.GetPointOfInterestById(id, Sources.OSM).Returns(new Feature
            {
                Attributes = new AttributesTable
                {
                    { FeatureAttributes.POI_ICON, "icon" }
                }
            });
            gateway.GetNode(42).Returns(new Node { Tags = new TagsCollection { { "website", "some-url" } }, Latitude = 0, Longitude = 0, Id = 42 });

            _adapter.UpdateFeature(poi, gateway, Languages.HEBREW).Wait();

            _wikimediaCommonGateway.DidNotReceive().UploadImage(Arg.Any<string>(), Arg.Any<string>(), Arg.Any<string>(), Arg.Any<string>(), Arg.Any<Stream>(), Arg.Any<Coordinate>());
            _wikimediaCommonGateway.DidNotReceive().GetImageUrl(Arg.Any<string>());
            gateway.DidNotReceive().UpdateElement(Arg.Any<long>(), Arg.Any<ICompleteOsmGeo>());
        }

        [TestMethod]
        public void UpdateFeature_IconChange_ShouldUpdateInOSM()
        {
            var user = new User { DisplayName = "DisplayName" };
            var gateway = SetupHttpFactory();
            gateway.GetUserDetails().Returns(user);
            const string id = "Node_42";
            var poi = new Feature(new Point(0, 0), new AttributesTable {
                { FeatureAttributes.POI_SOURCE, Sources.OSM },
                { FeatureAttributes.ID, id },
                { FeatureAttributes.POI_ICON, "icon-ruins" },
            });
            _pointsOfInterestRepository.GetPointOfInterestById(id, Sources.OSM).Returns(new Feature
            {
                Attributes = new AttributesTable
                {
                    { FeatureAttributes.POI_ICON, "icon-tint" }
                }
            });
            gateway.GetNode(42).Returns(new Node { Tags = new TagsCollection { { "natural", "spring" } }, Latitude = 0, Longitude = 0, Id = 42 });

            _adapter.UpdateFeature(poi, gateway, Languages.HEBREW).Wait();

            gateway.Received().UpdateElement(Arg.Any<long>(), Arg.Is<ICompleteOsmGeo>(o =>
                o.Tags.Any(t => t.Key == "historic" && t.Value == "ruins") &&
                o.Tags.All(t => t.Key != "natural"))
            );
        }

        [TestMethod]
        public void UpdateFeature_RemoveUrl_ShouldUpdateInOSM()
        {
            var user = new User { DisplayName = "DisplayName" };
            var gateway = SetupHttpFactory();
            gateway.GetUserDetails().Returns(user);
            var id = "Node_42";
            var poi = new Feature(new Point(0, 0), new AttributesTable {
                { FeatureAttributes.POI_SOURCE, Sources.OSM },
                { FeatureAttributes.ID, id },
                { FeatureAttributes.POI_ICON, "icon-ruins" },
                { FeatureAttributes.POI_REMOVED_URLS, new [] { "url-to-remove" } }
            });
            _pointsOfInterestRepository.GetPointOfInterestById(id, Sources.OSM).Returns(new Feature
            {
                Attributes = new AttributesTable
                {
                    { FeatureAttributes.POI_ICON, "icon-ruins" }
                }
            });
            gateway.GetNode(42).Returns(new Node { Tags = new TagsCollection {
                { "website", "url-to-remove" },
                { "website1", "url-to-keep" }
            }, Latitude = 0, Longitude = 0, Id = 42 });

            _adapter.UpdateFeature(poi, gateway, Languages.HEBREW).Wait();

            gateway.Received().UpdateElement(Arg.Any<long>(), Arg.Is<ICompleteOsmGeo>(o =>
                o.Tags.All(t => t.Key != "website1") && o.Tags.Any(t => t.Value == "url-to-keep")
            ));
        }
        
        [TestMethod]
        public void UpdateFeature_RemoveWikiUrl_ShouldUpdateInOSM()
        {
            var user = new User { DisplayName = "DisplayName" };
            var gateway = SetupHttpFactory();
            gateway.GetUserDetails().Returns(user);
            var id = "Node_42";
            var poi = new Feature(new Point(0, 0), new AttributesTable {
                { FeatureAttributes.POI_SOURCE, Sources.OSM },
                { FeatureAttributes.ID, id },
                { FeatureAttributes.POI_ICON, "icon-ruins" },
                { FeatureAttributes.POI_REMOVED_URLS, new [] { "https://he.wikipedia.org/wiki/123" } }
            });
            _pointsOfInterestRepository.GetPointOfInterestById(id, Sources.OSM).Returns(new Feature
            {
                Attributes = new AttributesTable
                {
                    { FeatureAttributes.POI_ICON, "icon-ruins" }
                }
            });
            gateway.GetNode(42).Returns(new Node { Tags = new TagsCollection {
                { "wikipedia", "he:123" },
                { "wikipedia:he", "123" },
                { "website", "url-to-keep" }
            }, Latitude = 0, Longitude = 0, Id = 42 });

            _adapter.UpdateFeature(poi, gateway, Languages.HEBREW).Wait();

            gateway.Received().UpdateElement(Arg.Any<long>(), Arg.Is<ICompleteOsmGeo>(o =>
                o.Tags.All(t => !t.Key.Contains("wikipedia")) && o.Tags.Any(t => t.Value == "url-to-keep")
            ));
        }

        [TestMethod]
        public void UpdateFeature_RemoveWikiUrl_ShouldUpdateInOSMButNotRemoveEnglishWikipedia()
        {
            var user = new User { DisplayName = "DisplayName" };
            var gateway = SetupHttpFactory();
            gateway.GetUserDetails().Returns(user);
            var id = "Node_42";
            var poi = new Feature(new Point(0, 0), new AttributesTable {
                { FeatureAttributes.POI_SOURCE, Sources.OSM },
                { FeatureAttributes.ID, id },
                { FeatureAttributes.POI_ICON, "icon-ruins" },
                { FeatureAttributes.POI_REMOVED_URLS, new [] { "https://he.wikipedia.org/wiki/123" } }
            });
            _pointsOfInterestRepository.GetPointOfInterestById(id, Sources.OSM).Returns(new Feature
            {
                Attributes = new AttributesTable
                {
                    { FeatureAttributes.POI_ICON, "icon-ruins" }
                }
            });
            gateway.GetNode(42).Returns(new Node { Tags = new TagsCollection {
                { "wikipedia", "en:456" },
                { "wikipedia:he", "123" },
                { "website", "url-to-keep" }
            }, Latitude = 0, Longitude = 0, Id = 42 });

            _adapter.UpdateFeature(poi, gateway, Languages.HEBREW).Wait();

            gateway.Received().UpdateElement(Arg.Any<long>(), Arg.Is<ICompleteOsmGeo>(o =>
                o.Tags.All(t => t.Key != "wikipedia:he") &&
                o.Tags.Any(t => t.Key == "wikipedia") &&
                o.Tags.Any(t => t.Value == "url-to-keep")
            ));
        }
        
        [TestMethod]
        public void UpdateFeature_RemoveImage_ShouldUpdateInOSM()
        {
            var user = new User { DisplayName = "DisplayName" };
            var gateway = SetupHttpFactory();
            gateway.GetUserDetails().Returns(user);
            var id = "Node_42";
            var poi = new Feature(new Point(0, 0), new AttributesTable {
                { FeatureAttributes.POI_SOURCE, Sources.OSM },
                { FeatureAttributes.ID, id },
                { FeatureAttributes.POI_ICON, "icon-ruins" },
                { FeatureAttributes.POI_REMOVED_IMAGES, new [] { "image-to-remove" } }
            });
            _pointsOfInterestRepository.GetPointOfInterestById(id, Sources.OSM).Returns(new Feature
            {
                Attributes = new AttributesTable
                {
                    { FeatureAttributes.POI_ICON, "icon-ruins" }
                }
            });
            gateway.GetNode(42).Returns(new Node { Tags = new TagsCollection {
                { "image", "image-to-remove" },
                { "image1", "some-image" }
            }, Latitude = 0, Longitude = 0, Id = 42 });

            _adapter.UpdateFeature(poi, gateway, Languages.HEBREW).Wait();

            gateway.Received().UpdateElement(Arg.Any<long>(), Arg.Is<ICompleteOsmGeo>(o =>
                o.Tags.All(t => t.Key != "image1") && o.Tags.All(t => t.Value != "image-to-remove")
            ));
        }

        [TestMethod]
        public void CreateFeatureFromCoordinates_ShouldCreate()
        {
            const int alt = 10;
            ElevationGateway.GetElevation(Arg.Any<Coordinate>()).Returns(alt);
            var feature = _adapter.GetCoordinatesFeature(new LatLng(35, 32), "32_35");

            Assert.IsNotNull(feature);
            Assert.AreEqual(feature.Geometry.Coordinate.X, 32);
            Assert.AreEqual(feature.Geometry.Coordinate.Y, 35);
            Assert.IsTrue(feature.Attributes.Exists(FeatureAttributes.POI_ITM_NORTH));
            Assert.IsTrue(feature.Attributes.Exists(FeatureAttributes.POI_ITM_EAST));
            Assert.IsTrue(feature.Attributes.Has(FeatureAttributes.POI_ALT, alt.ToString()));
            Assert.IsTrue(feature.Attributes.Exists(FeatureAttributes.POI_ICON));
            Assert.IsTrue(feature.Attributes.Exists(FeatureAttributes.POI_SOURCE));
        }
    }
}
