using System.Collections.Generic;
using System.Collections.ObjectModel;
using System.IO;
using System.Linq;
using GeoAPI.Geometries;
using IsraelHiking.API.Converters;
using IsraelHiking.API.Executors;
using IsraelHiking.API.Services;
using IsraelHiking.API.Services.Poi;
using IsraelHiking.Common;
using IsraelHiking.DataAccessInterfaces;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using Microsoft.VisualStudio.TestTools.UnitTesting;
using NetTopologySuite.Features;
using NetTopologySuite.Geometries;
using NSubstitute;
using OsmSharp;
using OsmSharp.Complete;
using OsmSharp.Tags;

namespace IsraelHiking.API.Tests.Services.Poi
{
    [TestClass]
    public class OsmPointsOfInterestAdapterTests : BasePointsOfInterestAdapterTestsHelper
    {
        private OsmPointsOfInterestAdapter _adapter;
        private IElasticSearchGateway _elasticSearchGateway;
        private IElevationDataStorage _elevationDataStorage;
        private IHttpGatewayFactory _httpGatewayFactory;
        private IOsmGeoJsonPreprocessorExecutor _osmGeoJsonPreprocessorExecutor;
        private IOsmRepository _osmRepository;
        private IDataContainerConverterService _dataContainerConverterService;
        private IWikipediaGateway _wikipediaGateway;
        private ITagsHelper _tagsHelper;

        [TestInitialize]
        public void TestInitialize()
        {
            _elasticSearchGateway = Substitute.For<IElasticSearchGateway>();
            _elevationDataStorage = Substitute.For<IElevationDataStorage>();
            _httpGatewayFactory = Substitute.For<IHttpGatewayFactory>();
            _tagsHelper = new TagsHelper(new OptionsWrapper<ConfigurationData>(new ConfigurationData()));
            _osmGeoJsonPreprocessorExecutor = new OsmGeoJsonPreprocessorExecutor(Substitute.For<ILogger>(), new OsmGeoJsonConverter(), _tagsHelper);
            _osmRepository = Substitute.For<IOsmRepository>();
            _dataContainerConverterService = Substitute.For<IDataContainerConverterService>();
            _wikipediaGateway = Substitute.For<IWikipediaGateway>();
            _adapter = new OsmPointsOfInterestAdapter(_elasticSearchGateway, _elevationDataStorage, _httpGatewayFactory, _osmGeoJsonPreprocessorExecutor, _osmRepository, _dataContainerConverterService, _wikipediaGateway, _tagsHelper);
        }

        private IOsmGateway SetupHttpFactory()
        {
            var gateway = Substitute.For<IOsmGateway>();
            _httpGatewayFactory.CreateOsmGateway(Arg.Any<TokenAndSecret>()).Returns(gateway);
            return gateway;
        }

        [TestMethod]
        public void GetPointsOfInterest_FilterRelevant_ShouldReturnEmptyElist()
        {
            _elasticSearchGateway.GetPointsOfInterest(null, null, null, null).Returns(new List<Feature>
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
            var feature = GetValidFeature("poiId", _adapter.Source);
            feature.Attributes.DeleteAttribute(FeatureAttributes.NAME);
            feature.Attributes.AddAttribute("name:en", name);
            _elasticSearchGateway.GetPointsOfInterest(null, null, null, "en").Returns(new List<Feature> { feature });

            var result = _adapter.GetPointsOfInterest(null, null, null, "en").Result;

            Assert.AreEqual(1, result.Length);
            Assert.AreEqual(name, result.First().Title);
        }

        [TestMethod]
        public void GetPointsOfInterest_ImageAndDescriptionOnly_ShouldReturnIt()
        {
            var feature = GetValidFeature("poiId", _adapter.Source);
            feature.Attributes.DeleteAttribute(FeatureAttributes.NAME);
            feature.Attributes.AddAttribute(FeatureAttributes.IMAGE_URL, FeatureAttributes.IMAGE_URL);
            feature.Attributes.AddAttribute(FeatureAttributes.WIKIPEDIA, FeatureAttributes.DESCRIPTION);
            _elasticSearchGateway.GetPointsOfInterest(null, null, null, "he").Returns(new List<Feature> { feature });

            var result = _adapter.GetPointsOfInterest(null, null, null, "he").Result;

            Assert.AreEqual(1, result.Length);
            Assert.AreEqual(string.Empty, result.First().Title);
        }

        [TestMethod]
        public void GetPointsOfInterestById_RouteWithMultipleAttributes_ShouldReturnIt()
        {
            var poiId = "poiId";
            var feature = GetValidFeature(poiId, _adapter.Source);
            feature.Attributes.DeleteAttribute(FeatureAttributes.NAME);
            feature.Attributes.AddAttribute(FeatureAttributes.IMAGE_URL, FeatureAttributes.IMAGE_URL);
            feature.Attributes.AddAttribute(FeatureAttributes.IMAGE_URL + "1", FeatureAttributes.IMAGE_URL + "1");
            feature.Attributes.AddAttribute(FeatureAttributes.DESCRIPTION, FeatureAttributes.DESCRIPTION);
            feature.Attributes.AddAttribute(FeatureAttributes.WIKIPEDIA + ":en", "page with space");
            _elasticSearchGateway.GetPointOfInterestById(poiId, _adapter.Source).Returns(feature);
            _wikipediaGateway.GetReference("page with space", "en").Returns(new Reference { Url = "page_with_space" });
            _dataContainerConverterService.ToDataContainer(Arg.Any<byte[]>(), Arg.Any<string>()).Returns(
                new DataContainer
                {
                    Routes = new List<RouteData>
                    {
                        new RouteData
                        {
                            Segments = new List<RouteSegmentData>
                            {
                                new RouteSegmentData(),
                                new RouteSegmentData()
                            }
                        }
                    }
                });

            var result = _adapter.GetPointOfInterestById(poiId, "en").Result;

            Assert.IsNotNull(result);
            Assert.AreEqual(string.Empty, result.Title);
            Assert.AreEqual(FeatureAttributes.DESCRIPTION, result.Description);
            Assert.AreEqual(2, result.ImagesUrls.Length);
            Assert.AreEqual(FeatureAttributes.IMAGE_URL, result.ImagesUrls.First());
            Assert.IsTrue(result.References.First().Url.Contains("page_with_space"));
            Assert.IsTrue(result.IsRoute);
        }

        [TestMethod]
        public void GetPointsOfInterestById_EmptyWikiTag_ShouldReturnIt()
        {
            var poiId = "poiId";
            var feature = GetValidFeature(poiId, _adapter.Source);
            feature.Attributes.AddAttribute(FeatureAttributes.WIKIPEDIA, string.Empty);
            feature.Attributes.AddAttribute(FeatureAttributes.WEBSITE, "website");
            _elasticSearchGateway.GetPointOfInterestById(poiId, _adapter.Source).Returns(feature);
            _dataContainerConverterService.ToDataContainer(Arg.Any<byte[]>(), Arg.Any<string>()).Returns(
                new DataContainer { Routes = new List<RouteData>() });
            _wikipediaGateway.GetByPageTitle(Arg.Any<string>(), Arg.Any<string>()).Returns(
                new FeatureCollection(new Collection<IFeature> {new Feature(new Point(0, 0), new AttributesTable())}));

            var result = _adapter.GetPointOfInterestById(poiId, null).Result;

            Assert.IsNotNull(result);
            Assert.AreEqual("website", result.References.First().Url);
        }

        [TestMethod]
        public void GetPointsOfInterestById_NonValidWikiTag_ShouldReturnIt()
        {
            var poiId = "poiId";
            var feature = GetValidFeature(poiId, _adapter.Source);
            feature.Attributes.AddAttribute(FeatureAttributes.WIKIPEDIA, "en:en:page");
            feature.Attributes.AddAttribute(FeatureAttributes.WEBSITE, "website");
            _elasticSearchGateway.GetPointOfInterestById(poiId, _adapter.Source).Returns(feature);
            _dataContainerConverterService.ToDataContainer(Arg.Any<byte[]>(), Arg.Any<string>()).Returns(
                new DataContainer { Routes = new List<RouteData>() });

            var result = _adapter.GetPointOfInterestById(poiId, null).Result;

            Assert.IsNotNull(result);
            Assert.AreEqual("website", result.References.First().Url);
        }

        [TestMethod]
        public void GetPointsOfInterestById_WithTwoReferences_ShouldReturnIt()
        {
            var poiId = "poiId";
            var language = "he";
            var feature = GetValidFeature(poiId, _adapter.Source);
            feature.Attributes.AddAttribute(FeatureAttributes.WIKIPEDIA + ":" + language, "page");
            feature.Attributes.AddAttribute(FeatureAttributes.WEBSITE, "website");
            _elasticSearchGateway.GetPointOfInterestById(poiId, _adapter.Source).Returns(feature);
            _dataContainerConverterService.ToDataContainer(Arg.Any<byte[]>(), Arg.Any<string>()).Returns(
                new DataContainer { Routes = new List<RouteData>() });
            _wikipediaGateway.GetByPageTitle(Arg.Any<string>(), Arg.Any<string>()).Returns(
                new FeatureCollection(new Collection<IFeature> {new Feature(new Point(0, 0), new AttributesTable())}));
            _wikipediaGateway.GetReference("page", language).Returns(new Reference { Url = "page" });

            var result = _adapter.GetPointOfInterestById(poiId, language).Result;

            Assert.IsNotNull(result);
            Assert.AreEqual(2, result.References.Length);
        }

        [TestMethod]
        public void GetPointsOfInterestById_WithMultipleWebsiteAndSourceImages_ShouldNotFail()
        {
            var poiId = "poiId";
            var language = "he";
            var feature = GetValidFeature(poiId, _adapter.Source);
            feature.Attributes.AddAttribute(FeatureAttributes.WEBSITE, "website");
            feature.Attributes.AddAttribute(FeatureAttributes.SOURCE_IMAGE_URL, "sourceimage");
            feature.Attributes.AddAttribute(FeatureAttributes.WEBSITE + "1", "website1");
            feature.Attributes.AddAttribute(FeatureAttributes.SOURCE_IMAGE_URL + "1", "sourceimage1");
            feature.Attributes.AddAttribute(FeatureAttributes.WEBSITE + "2", "website2");
            _elasticSearchGateway.GetPointOfInterestById(poiId, _adapter.Source).Returns(feature);
            _dataContainerConverterService.ToDataContainer(Arg.Any<byte[]>(), Arg.Any<string>()).Returns(
                new DataContainer { Routes = new List<RouteData>() });

            var result = _adapter.GetPointOfInterestById(poiId, language).Result;

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
            gateway.CreateElement(Arg.Any<string>(), Arg.Any<Node>()).Returns("42");
            var pointOfInterestToAdd = new PointOfInterestExtended
            {
                Location = new LatLng(),
                ImagesUrls = new [] { "image1", "image2" },
                Icon = _tagsHelper.GetCategoriesByType(Categories.POINTS_OF_INTEREST).First().Icon,
                References = new[]
                {
                    new Reference {Url = "he.wikipedia.org/wiki/%D7%AA%D7%9C_%D7%A9%D7%9C%D7%9D"}
                }
            };
            _dataContainerConverterService.ToDataContainer(Arg.Any<byte[]>(), Arg.Any<string>()).Returns(new DataContainer {Routes = new List<RouteData>()});
            _elasticSearchGateway.GetContainers(Arg.Any<Coordinate>()).Returns(new List<Feature>());

            var resutls = _adapter.AddPointOfInterest(pointOfInterestToAdd, null, language).Result;

            Assert.IsNotNull(resutls);
            _elasticSearchGateway.Received(1).UpdatePointsOfInterestData(Arg.Any<List<Feature>>());
            gateway.Received().CreateElement(Arg.Any<string>(), Arg.Is<OsmGeo>(x => x.Tags[FeatureAttributes.WIKIPEDIA + ":" + language].Contains("תל שלם")));
        }

        [TestMethod]
        public void UpdatePoint_SyncImages()
        {
            var gateway = SetupHttpFactory();
            var pointOfInterest = new PointOfInterestExtended
            {
                ImagesUrls = new[] { "imageurl2", "imageurl1", "imageurl4" },
                Id = "1",
                Icon = "oldIcon",
                Type = OsmGeoType.Node.ToString().ToLower(),
                References = new Reference[0]
            };
            _dataContainerConverterService.ToDataContainer(Arg.Any<byte[]>(), Arg.Any<string>()).Returns(new DataContainer {Routes = new List<RouteData>()});
            gateway.GetElement(pointOfInterest.Id, OsmGeoType.Node.ToString().ToLower()).Returns(new Node
            {
                Id = 1,
                Tags = new TagsCollection
                {
                    new Tag("image", "imageurl1"),
                    new Tag("image1", "imageurl3"),
                }
            });
            _elasticSearchGateway.GetContainers(Arg.Any<Coordinate>()).Returns(new List<Feature>());

            var results = _adapter.UpdatePointOfInterest(pointOfInterest, null, "en").Result;

            CollectionAssert.AreEqual(pointOfInterest.ImagesUrls.OrderBy(i => i).ToArray(), results.ImagesUrls.OrderBy(i => i).ToArray());
        }

        [TestMethod]
        public void UpdatePoint_CreateWikipediaTag()
        {
            var gateway = SetupHttpFactory();
            var pointOfInterest = new PointOfInterestExtended
            {
                ImagesUrls = new string[0],
                Id = "1",
                Icon = "oldIcon",
                Type = OsmGeoType.Node.ToString().ToLower(),
                References = new[]
                {
                    new Reference
                    {
                        Url = "http://en.wikipedia.org/wiki/Literary_Hall"
                    }
                }
            };
            _dataContainerConverterService.ToDataContainer(Arg.Any<byte[]>(), Arg.Any<string>()).Returns(new DataContainer { Routes = new List<RouteData>() });
            gateway.GetElement(pointOfInterest.Id, OsmGeoType.Node.ToString().ToLower()).Returns(new Node
            {
                Id = 1,
                Tags = new TagsCollection
                {
                    { FeatureAttributes.DESCRIPTION, "description" }
                }
            });
            _elasticSearchGateway.GetContainers(Arg.Any<Coordinate>()).Returns(new List<Feature>());

            _adapter.UpdatePointOfInterest(pointOfInterest, null, "en").Wait();

            gateway.Received().UpdateElement(Arg.Any<string>(), Arg.Is<ICompleteOsmGeo>(x => x.Tags.ContainsKey(FeatureAttributes.WIKIPEDIA + ":en") && x.Tags.Contains(FeatureAttributes.WIKIPEDIA, "en:Literary Hall")));
        }

        [TestMethod]
        public void UpdatePoint_DoNotUpdateInCaseTagsAreEqual()
        {
            var gateway = SetupHttpFactory();
            var pointOfInterest = new PointOfInterestExtended
            {
                ImagesUrls = new[] { "imageurl2", "imageurl1" },
                Id = "1",
                Icon = "oldIcon",
                Type = OsmGeoType.Node.ToString().ToLower(),
                References = new Reference[0]
            };
            _dataContainerConverterService.ToDataContainer(Arg.Any<byte[]>(), Arg.Any<string>()).Returns(new DataContainer { Routes = new List<RouteData>() });
            gateway.GetElement(pointOfInterest.Id, OsmGeoType.Node.ToString().ToLower()).Returns(new Node
            {
                Id = 1,
                Tags = new TagsCollection
                {
                    new Tag("image", "imageurl2"),
                    new Tag("image1", "imageurl1"),
                }
            });
            _elasticSearchGateway.GetContainers(Arg.Any<Coordinate>()).Returns(new List<Feature>());

            _adapter.UpdatePointOfInterest(pointOfInterest, null, "en").Wait();

            _elasticSearchGateway.DidNotReceive().UpdatePointsOfInterestData(Arg.Any<List<Feature>>());
            gateway.DidNotReceive().CreateChangeset(Arg.Any<string>());
            gateway.DidNotReceive().CloseChangeset(Arg.Any<string>());
        }

        [TestMethod]
        public void GetPointsForIndexing_ShouldRemoveKklRoutes()
        {
            var memoryStream = new MemoryStream();
            var osmNamesDictionary = new Dictionary<string, List<ICompleteOsmGeo>>
            {
                {
                    "name",
                    new List<ICompleteOsmGeo>
                    {
                        new Node
                        {
                            Id = 10,
                            Tags = new TagsCollection
                            {
                                {"natural", "spring"},
                            }
                        },
                        new CompleteRelation
                        {
                            Tags = new TagsCollection
                            {
                                {"operator", "kkl"},
                                {"route", "mtb"}
                            },
                            Members = new[]
                            {
                                new CompleteRelationMember {Member = new CompleteWay {Nodes = new []
                                {
                                    new Node {  Latitude = 0, Longitude = 0 },
                                    new Node {  Latitude = 1, Longitude = 1 },
                                    new Node {  Latitude = 2, Longitude = 2 }
                                }}, Role = "outer"}
                            }
                        }
                    }
                },
            };
            _osmRepository.GetElementsWithName(memoryStream).Returns(osmNamesDictionary);
            _osmRepository.GetPointsWithNoNameByTags(memoryStream, Arg.Any<List<KeyValuePair<string, string>>>()).Returns(new List<Node>());

            var results = _adapter.GetPointsForIndexing(memoryStream).Result;

            Assert.AreEqual(1, results.Count);
        }
    }
}
