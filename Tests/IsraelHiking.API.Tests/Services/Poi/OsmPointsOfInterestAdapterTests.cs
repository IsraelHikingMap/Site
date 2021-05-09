using IsraelHiking.API.Converters;
using IsraelHiking.API.Executors;
using IsraelHiking.API.Services;
using IsraelHiking.API.Services.Poi;
using IsraelHiking.Common;
using IsraelHiking.Common.DataContainer;
using IsraelHiking.Common.Extensions;
using IsraelHiking.Common.Poi;
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
    public class OsmPointsOfInterestAdapterTests : BasePointsOfInterestAdapterTestsHelper
    {
        private OsmPointsOfInterestAdapter _adapter;
        private IClientsFactory _clientsFactory;
        private IOsmGeoJsonPreprocessorExecutor _osmGeoJsonPreprocessorExecutor;
        private IOsmRepository _osmRepository;
        private IPointsOfInterestRepository _pointsOfInterestRepository;
        private IWikipediaGateway _wikipediaGateway;
        private IWikimediaCommonGateway _wikimediaCommonGateway;
        private IOsmLatestFileGateway _latestFileGateway;
        private IImagesUrlsStorageExecutor _imagesUrlsStorageExecutor;
        private ITagsHelper _tagsHelper;

        [TestInitialize]
        public void TestInitialize()
        {
            InitializeSubstitues();
            _clientsFactory = Substitute.For<IClientsFactory>();
            _tagsHelper = new TagsHelper(_options);
            _osmGeoJsonPreprocessorExecutor = new OsmGeoJsonPreprocessorExecutor(Substitute.For<ILogger>(),
                Substitute.For<IElevationDataStorage>(), 
                new ItmWgs84MathTransfromFactory(),
                new OsmGeoJsonConverter(new GeometryFactory()), _tagsHelper);
            _osmRepository = Substitute.For<IOsmRepository>();
            _wikipediaGateway = Substitute.For<IWikipediaGateway>();
            _latestFileGateway = Substitute.For<IOsmLatestFileGateway>();
            _pointsOfInterestRepository = Substitute.For<IPointsOfInterestRepository>();
            _imagesUrlsStorageExecutor = Substitute.For<IImagesUrlsStorageExecutor>();
            _wikimediaCommonGateway = Substitute.For<IWikimediaCommonGateway>();
            _adapter = new OsmPointsOfInterestAdapter(_pointsOfInterestRepository,
                _elevationDataStorage,
                _osmGeoJsonPreprocessorExecutor,
                _osmRepository,
                _dataContainerConverterService,
                _wikipediaGateway,
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
        public void GetPointsOfInterest_FilterRelevant_ShouldReturnEmptyElist()
        {
            _pointsOfInterestRepository.GetPointsOfInterest(null, null, null, null).Returns(new List<Feature>
            {
                new Feature { Geometry = new Point(null), Attributes = new AttributesTable() }
            });

            var results = _adapter.GetPointsOfInterest(null, null, null, null).Result;

            Assert.AreEqual(0, results.Length);
        }

        [TestMethod]
        public void GetPointsOfInterest_EnglishTitleOnly_ShouldReturnIt()
        {
            var name = "English name";
            var feature = GetValidFeature("poiId", Sources.OSM);
            feature.Attributes.DeleteAttribute(FeatureAttributes.NAME);
            feature.Attributes.Add("name:en", name);
            _pointsOfInterestRepository.GetPointsOfInterest(null, null, null, "en").Returns(new List<Feature> { feature });

            var result = _adapter.GetPointsOfInterest(null, null, null, "en").Result;

            Assert.AreEqual(1, result.Length);
            Assert.AreEqual(name, result.First().Title);
        }

        [TestMethod]
        public void GetPointsOfInterest_ImageAndDescriptionOnly_ShouldReturnIt()
        {
            var feature = GetValidFeature("poiId", Sources.OSM);
            feature.Attributes.DeleteAttribute(FeatureAttributes.NAME);
            feature.Attributes.Add(FeatureAttributes.IMAGE_URL, FeatureAttributes.IMAGE_URL);
            feature.Attributes.Add(FeatureAttributes.WIKIPEDIA, FeatureAttributes.DESCRIPTION);
            _pointsOfInterestRepository.GetPointsOfInterest(null, null, null, "he").Returns(new List<Feature> { feature });

            var result = _adapter.GetPointsOfInterest(null, null, null, "he").Result;

            Assert.AreEqual(1, result.Length);
            Assert.AreEqual(string.Empty, result.First().Title);
        }

        [TestMethod]
        public void GetPointsOfInterest_NoIcon_ShouldReturnItWithSearchIcon()
        {
            var feature = GetValidFeature("poiId", Sources.OSM);
            feature.Attributes.AddOrUpdate(FeatureAttributes.POI_ICON, string.Empty);
            _pointsOfInterestRepository.GetPointsOfInterest(null, null, null, "he").Returns(new List<Feature> { feature });

            var result = _adapter.GetPointsOfInterest(null, null, null, "he").Result;

            Assert.AreEqual(1, result.Length);
            Assert.AreEqual(OsmPointsOfInterestAdapter.SEARCH_ICON, result.First().Icon);
        }

        [TestMethod]
        public void GetPointsOfInterestById_RouteWithMultipleAttributes_ShouldReturnIt()
        {
            var poiId = "poiId";
            var feature = GetValidFeature(poiId, Sources.OSM);
            feature.Attributes.DeleteAttribute(FeatureAttributes.NAME);
            feature.Attributes.Add(FeatureAttributes.IMAGE_URL, FeatureAttributes.IMAGE_URL);
            feature.Attributes.Add(FeatureAttributes.IMAGE_URL + "1", FeatureAttributes.IMAGE_URL + "1");
            feature.Attributes.Add(FeatureAttributes.DESCRIPTION, FeatureAttributes.DESCRIPTION);
            feature.Attributes.Add(FeatureAttributes.WIKIPEDIA + ":en", "page with space");
            _pointsOfInterestRepository.GetPointOfInterestById(poiId, Sources.OSM).Returns(feature);
            _wikipediaGateway.GetReference("page with space", "en").Returns(new Reference { Url = "page_with_space" });
            _dataContainerConverterService.ToDataContainer(Arg.Any<byte[]>(), Arg.Any<string>()).Returns(
                new DataContainerPoco
                {
                    Routes = new List<RouteData>
                    {
                        new RouteData
                        {
                            Segments = new List<RouteSegmentData>
                            {
                                new RouteSegmentData
                                {
                                    Latlngs = new List<LatLngTime>
                                    {
                                        new LatLngTime(0,0),
                                        new LatLngTime(0.1,0.1)
                                    }
                                },
                                new RouteSegmentData()
                            }
                        }
                    }
                });

            var result = _adapter.GetPointOfInterestById(Sources.OSM, poiId, "en").Result;

            Assert.IsNotNull(result);
            Assert.AreEqual(string.Empty, result.Title);
            Assert.AreEqual(FeatureAttributes.DESCRIPTION, result.Description);
            Assert.AreEqual(2, result.ImagesUrls.Length);
            Assert.AreEqual(FeatureAttributes.IMAGE_URL, result.ImagesUrls.First());
            Assert.IsTrue(result.References.First().Url.Contains("page_with_space"));
            Assert.IsTrue(result.IsRoute);
            Assert.IsTrue(result.LengthInKm > 0);
        }

        [TestMethod]
        public void GetPointsOfInterestById_NonValidWikiTag_ShouldReturnIt()
        {
            var poiId = "poiId";
            var feature = GetValidFeature(poiId, Sources.OSM);
            feature.Attributes.Add(FeatureAttributes.WIKIPEDIA, "en:en:page");
            feature.Attributes.Add(FeatureAttributes.WEBSITE, "website");
            _pointsOfInterestRepository.GetPointOfInterestById(poiId, Sources.OSM).Returns(feature);
            _dataContainerConverterService.ToDataContainer(Arg.Any<byte[]>(), Arg.Any<string>()).Returns(
                new DataContainerPoco { Routes = new List<RouteData>() });

            var result = _adapter.GetPointOfInterestById(Sources.OSM, poiId, null).Result;

            Assert.IsNotNull(result);
            Assert.AreEqual("website", result.References.First().Url);
        }

        [TestMethod]
        public void GetPointsOfInterestById_WithMultipleWebsiteAndSourceImages_ShouldNotFail()
        {
            var poiId = "poiId";
            var language = "he";
            var feature = GetValidFeature(poiId, Sources.OSM);
            feature.Attributes.Add(FeatureAttributes.WEBSITE, "website");
            feature.Attributes.Add(FeatureAttributes.POI_SOURCE_IMAGE_URL, "sourceimage");
            feature.Attributes.Add(FeatureAttributes.WEBSITE + "1", "website1");
            feature.Attributes.Add(FeatureAttributes.POI_SOURCE_IMAGE_URL + "1", "sourceimage1");
            feature.Attributes.Add(FeatureAttributes.WEBSITE + "2", "website2");
            _pointsOfInterestRepository.GetPointOfInterestById(poiId, Sources.OSM).Returns(feature);
            _dataContainerConverterService.ToDataContainer(Arg.Any<byte[]>(), Arg.Any<string>()).Returns(
                new DataContainerPoco { Routes = new List<RouteData>() });

            var result = _adapter.GetPointOfInterestById(Sources.OSM, poiId, language).Result;

            Assert.IsNotNull(result);
            Assert.AreEqual(3, result.References.Length);
            Assert.AreEqual("sourceimage", result.References.Last().SourceImageUrl);
            Assert.AreEqual("sourceimage1", result.References[1].SourceImageUrl);
        }

        [TestMethod]
        public void AddPointOfInterest_ShouldUpdateOsmAndElasticSearch()
        {
            var gateway = SetupHttpFactory();
            var language = "he";
            gateway.CreateElement(Arg.Any<long>(), Arg.Any<Node>()).Returns(42);
            var pointOfInterestToAdd = new PointOfInterestExtended
            {
                Location = new LatLng(),
                ImagesUrls = new [] { "image1", "image2" },
                Icon = _tagsHelper.GetCategoriesByGroup(Categories.POINTS_OF_INTEREST).First().Icon,
                References = new[]
                {
                    new Reference {Url = "he.wikipedia.org/wiki/%D7%AA%D7%9C_%D7%A9%D7%9C%D7%9D"}
                }
            };
            _dataContainerConverterService.ToDataContainer(Arg.Any<byte[]>(), Arg.Any<string>()).Returns(new DataContainerPoco {Routes = new List<RouteData>()});
            _wikipediaGateway.GetReference(Arg.Any<string>(), language).Returns(new Reference { Url = "Some-Url" });

            var resutls = _adapter.AddPointOfInterest(pointOfInterestToAdd, gateway, language).Result;

            Assert.IsNotNull(resutls);
            _pointsOfInterestRepository.Received(1).UpdatePointsOfInterestData(Arg.Any<List<Feature>>());
            gateway.Received().CreateElement(Arg.Any<long>(), Arg.Is<OsmGeo>(x => x.Tags[FeatureAttributes.WIKIPEDIA + ":" + language].Contains("תל שלם")));
        }

        [TestMethod]
        public void AddPointOfInterest_WikipediaMobildLink_ShouldUpdateOsmAndElasticSearch()
        {
            var gateway = SetupHttpFactory();
            var language = "he";
            gateway.CreateElement(Arg.Any<long>(), Arg.Any<Node>()).Returns(42);
            var pointOfInterestToAdd = new PointOfInterestExtended
            {
                Location = new LatLng(),
                ImagesUrls = new[] { "image1", "image2" },
                Icon = _tagsHelper.GetCategoriesByGroup(Categories.POINTS_OF_INTEREST).First().Icon,
                References = new[]
                {
                    new Reference {Url = "https://he.m.wikipedia.org/wiki/%D7%96%D7%95%D7%94%D7%A8_(%D7%9E%D7%95%D7%A9%D7%91)"}
                }
            };
            _dataContainerConverterService.ToDataContainer(Arg.Any<byte[]>(), Arg.Any<string>()).Returns(new DataContainerPoco { Routes = new List<RouteData>() });
            _wikipediaGateway.GetReference(Arg.Any<string>(), language).Returns(new Reference { Url = "Some-Url" });

            var resutls = _adapter.AddPointOfInterest(pointOfInterestToAdd, gateway, language).Result;

            Assert.IsNotNull(resutls);
            _pointsOfInterestRepository.Received(1).UpdatePointsOfInterestData(Arg.Any<List<Feature>>());
            gateway.Received().CreateElement(Arg.Any<long>(), Arg.Is<OsmGeo>(x => x.Tags[FeatureAttributes.WIKIPEDIA + ":" + language].Contains("זוהר")));
        }

        [TestMethod]
        public void UpdatePointWithTwoIcon_ShouldUpdate()
        {
            var gateway = SetupHttpFactory();
            var pointOfInterest = new PointOfInterestExtended
            {
                ImagesUrls = new string[0],
                Id = "Node_1",
                Icon = "icon-cave",
                Description = "new description",
                References = new Reference[0],
                Location = new LatLng(0,0)
            };
            _dataContainerConverterService.ToDataContainer(Arg.Any<byte[]>(), Arg.Any<string>()).Returns(new DataContainerPoco { Routes = new List<RouteData>() });
            gateway.GetNode(1).Returns(new Node
            {
                Id = 1,
                Tags = new TagsCollection
                {
                    new Tag("historic", "archaeological_site"),
                    new Tag("natural", "cave_entrance"),
                },
                Latitude = 0,
                Longitude = 0
            });

            var results = _adapter.UpdatePointOfInterest(pointOfInterest, gateway, "en").Result;

            CollectionAssert.AreEqual(pointOfInterest.ImagesUrls.OrderBy(i => i).ToArray(), results.ImagesUrls.OrderBy(i => i).ToArray());
        }

        [TestMethod]
        public void UpdatePoint_SyncImages()
        {
            var gateway = SetupHttpFactory();
            var pointOfInterest = new PointOfInterestExtended
            {
                ImagesUrls = new[] { "imageurl2", "imageurl1", "imageurl4" },
                Id = "Node_1",
                Icon = "oldIcon",
                References = new Reference[0],
                Location = new LatLng(0, 0)
            };
            _dataContainerConverterService.ToDataContainer(Arg.Any<byte[]>(), Arg.Any<string>()).Returns(new DataContainerPoco {Routes = new List<RouteData>()});
            gateway.GetNode(1).Returns(new Node
            {
                Id = 1,
                Tags = new TagsCollection
                {
                    new Tag("image", "imageurl1"),
                    new Tag("image1", "imageurl3"),
                },
                Latitude = 0,
                Longitude = 0
            });

            var results = _adapter.UpdatePointOfInterest(pointOfInterest, gateway, "en").Result;

            CollectionAssert.AreEqual(pointOfInterest.ImagesUrls.OrderBy(i => i).ToArray(), results.ImagesUrls.OrderBy(i => i).ToArray());
        }

        [TestMethod]
        public void UpdatePoint_CreateWikipediaTag()
        {
            var gateway = SetupHttpFactory();
            var pointOfInterest = new PointOfInterestExtended
            {
                ImagesUrls = new string[0],
                Id = "Node_1",
                Icon = "oldIcon",
                References = new[]
                {
                    new Reference
                    {
                        Url = "http://en.wikipedia.org/wiki/Literary_Hall"
                    }
                },
                Location = new LatLng(0, 0)
            };
            _dataContainerConverterService.ToDataContainer(Arg.Any<byte[]>(), Arg.Any<string>()).Returns(new DataContainerPoco { Routes = new List<RouteData>() });
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
            _wikipediaGateway.GetReference(Arg.Any<string>(), "en").Returns(new Reference { Url = "Some-Url" });
            
            _adapter.UpdatePointOfInterest(pointOfInterest, gateway, "en").Wait();

            gateway.Received().UpdateElement(Arg.Any<long>(), Arg.Is<ICompleteOsmGeo>(x => x.Tags.ContainsKey(FeatureAttributes.WIKIPEDIA + ":en") && x.Tags.Contains(FeatureAttributes.WIKIPEDIA, "en:Literary Hall")));
        }

        [TestMethod]
        public void UpdatePoint_DoNotUpdateInCaseTagsAreEqual()
        {
            var gateway = SetupHttpFactory();
            var pointOfInterest = new PointOfInterestExtended
            {
                ImagesUrls = new[] { "imageurl2", "imageurl1" },
                Id = "Node_1",
                Icon = "oldIcon",
                References = new Reference[0],
                Location = new LatLng(0, 0)
            };
            _dataContainerConverterService.ToDataContainer(Arg.Any<byte[]>(), Arg.Any<string>()).Returns(new DataContainerPoco { Routes = new List<RouteData>() });
            gateway.GetNode(1).Returns(new Node
            {
                Id = 1,
                Tags = new TagsCollection
                {
                    new Tag("image", "imageurl2"),
                    new Tag("image1", "imageurl1"),
                },
                Latitude = 0,
                Longitude = 0
            });

            _adapter.UpdatePointOfInterest(pointOfInterest, gateway, "en").Wait();

            _pointsOfInterestRepository.DidNotReceive().UpdatePointsOfInterestData(Arg.Any<List<Feature>>());
            gateway.DidNotReceive().CreateChangeset(Arg.Any<TagsCollection>());
            gateway.DidNotReceive().CloseChangeset(Arg.Any<long>());
        }

        [TestMethod]
        public void UpdatePoint_TwoPointWithDifferentLocation_ShouldUpdateOnlyLocation()
        {
            var gateway = SetupHttpFactory();
            var pointOfInterest = new PointOfInterestExtended
            {
                ImagesUrls = new string[0],
                Id = "Node_1",
                Icon = "oldIcon",
                References = new Reference[0],
                Location = new LatLng(1, 1)
            };
            _dataContainerConverterService.ToDataContainer(Arg.Any<byte[]>(), Arg.Any<string>()).Returns(new DataContainerPoco { Routes = new List<RouteData>() });
            gateway.GetNode(1).Returns(new Node
            {
                Id = 1,
                Tags = new TagsCollection { { "some", "thing" } },
                Latitude = 0,
                Longitude = 0
            });

            _adapter.UpdatePointOfInterest(pointOfInterest, gateway, "en").Wait();

            _pointsOfInterestRepository.Received(1).UpdatePointsOfInterestData(Arg.Any<List<Feature>>());
            gateway.Received(1).CreateChangeset(Arg.Any<TagsCollection>());
            gateway.Received(1).UpdateElement(Arg.Any<long>(), Arg.Is<Node>(n => n.Longitude == 1 && n.Latitude == 1) as ICompleteOsmGeo);
            gateway.Received(1).CloseChangeset(Arg.Any<long>());
        }

        [TestMethod]
        public void GetPointsForIndexing_ShouldGetThem()
        {
            var features = new List<Feature>();
            _latestFileGateway.Get().Returns(new MemoryStream());
            _osmRepository.GetElementsWithName(Arg.Any<Stream>()).Returns(new List<ICompleteOsmGeo>());
            _osmRepository.GetPointsWithNoNameByTags(Arg.Any<Stream>(), Arg.Any<List<KeyValuePair<string, string>>>())
                .Returns(new List<Node>());

            var results = _adapter.GetAll().Result;

            Assert.AreEqual(features.Count, results.Count);
        }

        [TestMethod]
        public void GetClosestPoint_ShouldGetTheClosesOsmPoint()
        {
            var list = new List<Feature>
            {
                new Feature(new LineString(new Coordinate[0]), new AttributesTable
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

            var results = _adapter.GetClosestPoint(new Coordinate(0,0), Sources.OSM, "").Result;

            Assert.AreEqual(list.Last(), results);
        }

        [TestMethod]
        public void UpdateFeature_WithImageIdExists_ShouldUpdate()
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
            var id = "Node_42";
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
            var id = "Node_42";
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
            var id = "Node_42";
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
                o.Tags.All(t => t.Key != "image1") && o.Tags.All(t => t.Value != "iamge-to-remove")
            ));
        }

        [TestMethod]
        public void CreateFeatureFromCoordinates_ShouldCreate()
        {
            var alt = 10;
            _elevationDataStorage.GetElevation(Arg.Any<Coordinate>()).Returns(alt);
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
