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
using System.IO;
using System.Linq;
using System.Security.Cryptography;
using System.Text;
using System.Threading.Tasks;
using IsraelHiking.API.Gpx;

namespace IsraelHiking.API.Tests.Services.Poi;

[TestClass]
public class PointsOfInterestProviderTests : BasePointsOfInterestAdapterTestsHelper
{
    private PointsOfInterestProvider _adapter;
    private IClientsFactory _clientsFactory;
    private IOsmGeoJsonPreprocessorExecutor _osmGeoJsonPreprocessorExecutor;
    private IPointsOfInterestRepository _pointsOfInterestRepository;
    private IExternalSourcesRepository _externalSourcesRepository;
    private IWikimediaCommonGateway _wikimediaCommonGateway;
    private IImagesUrlsStorageExecutor _imagesUrlsStorageExecutor;
    private ITagsHelper _tagsHelper;

    [TestInitialize]
    public void TestInitialize()
    {
        InitializeSubstitutes();
        _clientsFactory = Substitute.For<IClientsFactory>();
        _tagsHelper = new TagsHelper(_options);
        _osmGeoJsonPreprocessorExecutor = new OsmGeoJsonPreprocessorExecutor(Substitute.For<ILogger>(),
            new OsmGeoJsonConverter(new GeometryFactory()), _tagsHelper);
        _pointsOfInterestRepository = Substitute.For<IPointsOfInterestRepository>();
        _externalSourcesRepository = Substitute.For<IExternalSourcesRepository>();
        _imagesUrlsStorageExecutor = Substitute.For<IImagesUrlsStorageExecutor>();
        _wikimediaCommonGateway = Substitute.For<IWikimediaCommonGateway>();
        _adapter = new PointsOfInterestProvider(_pointsOfInterestRepository,
            _externalSourcesRepository,
            _osmGeoJsonPreprocessorExecutor,
            _wikimediaCommonGateway,
            new Base64ImageStringToFileConverter(),
            _imagesUrlsStorageExecutor,
            _tagsHelper, _clientsFactory,
            Substitute.For<ILogger>());
    }

    private IAuthClient SetupOsmAuthClient()
    {
        var gateway = Substitute.For<IAuthClient>();
        _clientsFactory.CreateOAuth2Client(Arg.Any<string>()).Returns(gateway);
        return gateway;
    }
        
    private INonAuthClient SetupOsmNonAuthClient()
    {
        var gateway = Substitute.For<INonAuthClient>();
        _clientsFactory.CreateNonAuthClient().Returns(gateway);
        return gateway;
    }

    [TestMethod]
    public void GetFeatureById_RouteWithMultipleAttributes_ShouldReturnIt()
    {
        var someId = "node_123";
        var gateway = SetupOsmNonAuthClient();
        var node = new Node
        {
            Id = 123,
            Tags = new TagsCollection()
        };
        node.Tags.Add(new Tag(FeatureAttributes.IMAGE_URL, FeatureAttributes.IMAGE_URL));
        node.Tags.Add(new Tag(FeatureAttributes.IMAGE_URL+ "1", FeatureAttributes.IMAGE_URL+ "1"));
        node.Tags.Add(new Tag(FeatureAttributes.DESCRIPTION, FeatureAttributes.DESCRIPTION));
        node.Tags.Add(new Tag(FeatureAttributes.WIKIPEDIA + ":" + Languages.ENGLISH, "page with space"));
        gateway.GetNode(node.Id.Value).Returns(node);
            
        var result = _adapter.GetFeatureById(Sources.OSM, someId).Result;

        Assert.IsNotNull(result);
        Assert.AreEqual(string.Empty, result.GetTitle(Languages.ENGLISH));
        Assert.AreEqual(FeatureAttributes.DESCRIPTION, result.GetDescription(Languages.ENGLISH));
        var imagesUrls = result.Attributes.GetNames()
            .Where(n => n.StartsWith(FeatureAttributes.IMAGE_URL))
            .Select(p => node.Tags.GetValue(p).ToString())
            .ToArray();
        Assert.AreEqual(2, imagesUrls.Length);
        Assert.AreEqual(FeatureAttributes.IMAGE_URL, imagesUrls.First());
        Assert.IsTrue(result.Attributes[FeatureAttributes.WIKIPEDIA + ":" + Languages.ENGLISH].ToString()?.Contains("page with space"));
    }
        
    [TestMethod]
    public void GetFeatureById_FeatureDoesNotExist_ShouldReturnNull()
    {
        _externalSourcesRepository.GetExternalPoiById("42", Sources.INATURE).Returns(Task.FromResult<IFeature>(null));

        var result = _adapter.GetFeatureById(Sources.INATURE, "42").Result;

        Assert.IsNull(result);
    }
        
        
    [TestMethod]
    public void GetFeatureById_NonOsmWithNoElevation_ShouldNotAddElevation()
    {
        var someId = "some-id";
        var featureStr =
            "{ " +
            "\"type\": \"FeatureCollection\"," +
            "\"features\": [" +
            "   { " +
            "       \"type\": \"Feature\", " +
            "       \"properties\": {}, " +
            "       \"geometry\": {" +
            "           \"type\": \"LineString\", " +
            "           \"coordinates\": [[0,0], [0,1]] " +
            "       } " +
            "   }]" +
            "}";
        var col = Encoding.UTF8.GetBytes(featureStr).ToFeatureCollection();
        col.First().Attributes[FeatureAttributes.ID] = "42";
        col.First().Attributes[FeatureAttributes.POI_SOURCE] = Sources.INATURE;
        col.First().Attributes[FeatureAttributes.POI_ICON] = null;

        var feature = col.First();
            
        _externalSourcesRepository.GetExternalPoiById(someId, Sources.INATURE).Returns(feature);

        var result = _adapter.GetFeatureById(Sources.INATURE, someId).Result;

        Assert.IsNotNull(result);
        Assert.AreEqual(double.NaN, result.Geometry.Coordinates.First().Z);
    }

    [TestMethod]
    public void AddFeature_ShouldUpdateOsmAndElasticSearch()
    {
        var user = new User { DisplayName = "DisplayName" };
        var gateway = SetupOsmAuthClient();
        gateway.GetUserDetails().Returns(user);
        var language = Languages.HEBREW;
        gateway.CreateElement(Arg.Any<long>(), Arg.Any<Node>()).Returns(42);
        var feature = GetValidFeature("42", Sources.OSM);
        feature.Attributes.AddOrUpdate(FeatureAttributes.IMAGE_URL, "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAUAAAAFCAYAAACNbyblAAAAHElEQVQI12P4//" +
                                                                    "8/w38GIAXDIBKE0DHxgljNBAAO9TXL0Y4OHwAAAABJRU5ErkJggg==");
        feature.Attributes.AddOrUpdate(FeatureAttributes.POI_ICON, _tagsHelper.GetCategoriesByGroup(Categories.POINTS_OF_INTEREST).First().Icon);
        feature.Attributes.AddOrUpdate(FeatureAttributes.WEBSITE, "he.wikipedia.org/wiki/%D7%AA%D7%9C_%D7%A9%D7%9C%D7%9D");
        feature.Attributes.AddOrUpdate(FeatureAttributes.WEBSITE + "1", "www.wikidata.org/wiki/Q19401334");
        _imagesUrlsStorageExecutor.GetImageUrlIfExists(Arg.Any<MD5>(), Arg.Any<byte[]>()).Returns((string)null);
            
        var results = _adapter.AddFeature(feature, gateway, language).Result;

        Assert.IsNotNull(results);
        gateway.Received().CreateElement(Arg.Any<long>(), Arg.Is<OsmGeo>(x => x.Tags[FeatureAttributes.WIKIPEDIA + ":" + language].Contains("תל שלם")));
        gateway.Received().CreateElement(Arg.Any<long>(), Arg.Is<OsmGeo>(x => x.Tags[FeatureAttributes.WIKIDATA].Equals("Q19401334")));
        gateway.Received().CreateChangeset(Arg.Any<TagsCollectionBase>());
        gateway.Received().CloseChangeset(Arg.Any<long>());
    }
        
    [TestMethod]
    public void AddFeature_WithExtraSpaces_ShouldRemoveExtraSpaces()
    {
        var user = new User { DisplayName = "DisplayName" };
        var gateway = SetupOsmAuthClient();
        gateway.GetUserDetails().Returns(user);
        var language = Languages.HEBREW;
        gateway.CreateElement(Arg.Any<long>(), Arg.Any<Node>()).Returns(42);
        var feature = GetValidFeature("42", Sources.OSM);
        feature.Attributes.AddOrUpdate(FeatureAttributes.POI_ICON, _tagsHelper.GetCategoriesByGroup(Categories.POINTS_OF_INTEREST).First().Icon);
        feature.Attributes.AddOrUpdate(FeatureAttributes.NAME, " a   b  c ");
        feature.Attributes.AddOrUpdate(FeatureAttributes.DESCRIPTION, "  ");
        _imagesUrlsStorageExecutor.GetImageUrlIfExists(Arg.Any<MD5>(), Arg.Any<byte[]>()).Returns((string)null);
            
        var results = _adapter.AddFeature(feature, gateway, language).Result;

        Assert.IsNotNull(results);
        gateway.Received().CreateElement(Arg.Any<long>(), Arg.Is<OsmGeo>(x => 
            x.Tags[FeatureAttributes.NAME + ":" + language].Equals("a b c") && 
            x.Tags.All(t => t.Key != FeatureAttributes.DESCRIPTION)));
        gateway.Received().CreateChangeset(Arg.Any<TagsCollectionBase>());
        gateway.Received().CloseChangeset(Arg.Any<long>());
    }

    [TestMethod]
    public void AddFeature_WikipediaMobileLink_ShouldUpdateOsmAndElasticSearch()
    {
        var gateway = SetupOsmAuthClient();
        var language = Languages.HEBREW;
        gateway.CreateElement(Arg.Any<long>(), Arg.Any<Node>()).Returns(42);
        var feature = GetValidFeature("42", Sources.OSM);
        feature.Attributes.AddOrUpdate(FeatureAttributes.POI_ICON, _tagsHelper.GetCategoriesByGroup(Categories.POINTS_OF_INTEREST).First().Icon);
        feature.Attributes.AddOrUpdate(FeatureAttributes.WEBSITE, "https://he.m.wikipedia.org/wiki/%D7%96%D7%95%D7%94%D7%A8_(%D7%9E%D7%95%D7%A9%D7%91)");            
            
        var results = _adapter.AddFeature(feature, gateway, language).Result;

        Assert.IsNotNull(results);
        gateway.Received().CreateElement(Arg.Any<long>(), Arg.Is<OsmGeo>(x => x.Tags[FeatureAttributes.WIKIPEDIA + ":" + language].Contains("זוהר")));
    }

    [TestMethod]
    public void UpdateFeature_CreateWikipediaTag()
    {
        var gateway = SetupOsmAuthClient();
        var feature = GetValidFeature("Node_1", Sources.OSM);
        feature.Attributes.AddOrUpdate(FeatureAttributes.POI_ICON, "oldIcon");
        feature.Attributes.AddOrUpdate(FeatureAttributes.POI_ADDED_URLS, new[] { "https://en.wikipedia.org/wiki/Literary_Hall" });
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
            
        _adapter.UpdateFeature(feature, gateway, Languages.ENGLISH).Wait();

        gateway.Received().UpdateElement(Arg.Any<long>(), Arg.Is<ICompleteOsmGeo>(x => x.Tags.ContainsKey(FeatureAttributes.WIKIPEDIA + ":" + Languages.ENGLISH) && x.Tags.Contains(FeatureAttributes.WIKIPEDIA, "en:Literary Hall")));
        gateway.Received().CreateChangeset(Arg.Any<TagsCollectionBase>());
        gateway.Received().CloseChangeset(Arg.Any<long>());
    }

    [TestMethod]
    public void UpdateFeature_HasLanguageSpecificDescription_ShouldUpdateBoth()
    {
        var gateway = SetupOsmAuthClient();
        var feature = GetValidFeature("Node_1", Sources.OSM);
        feature.Attributes.AddOrUpdate(FeatureAttributes.POI_ICON, "oldIcon");
        feature.Attributes.AddOrUpdate(FeatureAttributes.DESCRIPTION, "new description");
        gateway.GetNode(1).Returns(new Node
        {
            Id = 1,
            Tags = new TagsCollection
            {
                { FeatureAttributes.DESCRIPTION + ":" + Languages.ENGLISH, "description" },
                { FeatureAttributes.DESCRIPTION, "description" }
            },
            Latitude = 0,
            Longitude = 0
        });
            
        _adapter.UpdateFeature(feature, gateway, Languages.ENGLISH).Wait();

        gateway.Received().UpdateElement(Arg.Any<long>(),
            Arg.Is<ICompleteOsmGeo>(x =>
                x.Tags.GetValue(FeatureAttributes.DESCRIPTION + ":" + Languages.ENGLISH) == "new description" &&
                x.Tags.GetValue(FeatureAttributes.DESCRIPTION) == "new description"));
    }
        
    [TestMethod]
    public void UpdateFeature_UpdateLocationToALocationTooClose_ShouldNotUpdate()
    {
        var gateway = SetupOsmAuthClient();
        var feature = GetValidFeature("Node_1", Sources.OSM);
        feature.SetLocation(new Coordinate(1.00000000001,1));
        gateway.GetNode(1).Returns(new Node
        {
            Id = 1,
            Tags = new TagsCollection
            {
                {FeatureAttributes.NAME, "name"},
                {FeatureAttributes.NAME + ":" + Languages.ENGLISH, "name"}
            },
            Latitude = 1,
            Longitude = 1
        });
            
        _adapter.UpdateFeature(feature, gateway, Languages.ENGLISH).Wait();

        gateway.DidNotReceive().UpdateElement(Arg.Any<long>(), Arg.Any<ICompleteOsmGeo>());
    }
        
    [TestMethod]
    public void UpdateFeature_OnlyChangeExtraSpaces_ShouldNotUpdate()
    {
        var gateway = SetupOsmAuthClient();
        var featureBeforeUpdate = GetValidFeature("Node_1", Sources.OSM);
        var featureUpdate = new Feature(featureBeforeUpdate.Geometry, new AttributesTable
        {
            { FeatureAttributes.POI_ID, featureBeforeUpdate.GetId()},
            { FeatureAttributes.ID, featureBeforeUpdate.Attributes[FeatureAttributes.ID]},
            { FeatureAttributes.NAME, "name " }
        });
        gateway.GetNode(1).Returns(new Node
        {
            Id = 1,
            Tags = new TagsCollection
            {
                {FeatureAttributes.NAME, "name"},
                {FeatureAttributes.NAME + ":" + Languages.ENGLISH, "name"}
            },
            Latitude = 1,
            Longitude = 1
        });
            
        _adapter.UpdateFeature(featureUpdate, gateway, Languages.ENGLISH).Wait();

        gateway.DidNotReceive().UpdateElement(Arg.Any<long>(), Arg.Any<ICompleteOsmGeo>());
    }

    [TestMethod]
    public void UpdateFeature_UpdateLocationOfWay_ShouldNotUpdate()
    {
        var gateway = SetupOsmAuthClient();
        var feature = GetValidFeature("Way_1", Sources.OSM);
        feature.SetLocation(new Coordinate(1, 1));
        gateway.GetCompleteWay(1).Returns(new CompleteWay
        {
            Id = 1,
            Tags = new TagsCollection
            {
                { FeatureAttributes.NAME, "name" },
                { FeatureAttributes.NAME + ":" + Languages.ENGLISH, "name" }
            },
            Nodes =
            [
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
                }
            ]
        });

        _adapter.UpdateFeature(feature, gateway, Languages.ENGLISH).Wait();

        gateway.DidNotReceive().UpdateElement(Arg.Any<long>(), Arg.Any<ICompleteOsmGeo>());
    }

    [TestMethod]
    public void GetClosestPoint_ShouldGetTheClosesOsmPoint()
    {
        var feature = new Feature(new LineString([]), new AttributesTable
        {
            { FeatureAttributes.POI_SOURCE, Sources.OSM }
        });
        _pointsOfInterestRepository.GetClosestPoint(Arg.Any<Coordinate>(), Arg.Any<string>(), Arg.Any<string>()).Returns(feature);

        var results = _adapter.GetClosestPoint(new Coordinate(0,0), Sources.OSM, null).Result;

        Assert.AreEqual(feature, results);
    }

    [TestMethod]
    public void UpdateFeature_WithImageIdExists_ShouldUpdate()
    {
        var user = new User { DisplayName = "DisplayName" };
        var gateway = SetupOsmAuthClient();
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
        gateway.GetNode(42).Returns(new Node { Tags = new TagsCollection {
            { "description:he", "description" },
            { "name:he", "name" },
        }, Latitude = 0, Longitude = 0, Id = 42 });

        _adapter.UpdateFeature(poi, gateway, Languages.HEBREW).Wait();

        _wikimediaCommonGateway.Received(1).UploadImage("name.png", "description", user.DisplayName, Arg.Any<Stream>(), Arg.Any<Coordinate>());
        _wikimediaCommonGateway.Received(1).GetImageUrl(Arg.Any<string>());
        _imagesUrlsStorageExecutor.Received(1).StoreImage(Arg.Any<MD5>(), Arg.Any<byte[]>(), Arg.Any<string>());
    }
        
    [TestMethod]
    public void UpdateFeature_WithImageWithDot_ShouldUpdate()
    {
        var user = new User { DisplayName = "DisplayName" };
        var gateway = SetupOsmAuthClient();
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
        gateway.GetNode(42).Returns(new Node { Tags = new TagsCollection {
            { "description:he", "description" },
            { "name:he", "name.1" },
        }, Latitude = 0, Longitude = 0, Id = 42 });

        _adapter.UpdateFeature(poi, gateway, Languages.HEBREW).Wait();

        _wikimediaCommonGateway.Received(1).UploadImage("name.1.png", "description", user.DisplayName, Arg.Any<Stream>(), Arg.Any<Coordinate>());
        _wikimediaCommonGateway.Received(1).GetImageUrl(Arg.Any<string>());
        _imagesUrlsStorageExecutor.Received(1).StoreImage(Arg.Any<MD5>(), Arg.Any<byte[]>(), Arg.Any<string>());
    }
        
    [TestMethod]
    public void UpdateFeature_WithEmptyDescriptionAndTitle_ShouldUpdateWithIconName()
    {
        var user = new User { DisplayName = "DisplayName" };
        var gateway = SetupOsmAuthClient();
        gateway.GetUserDetails().Returns(user);
        const string id = "Node_42";
        var poi = new Feature(new Point(0, 0), new AttributesTable {
            { FeatureAttributes.POI_SOURCE, Sources.OSM },
            { FeatureAttributes.ID, id },
            { FeatureAttributes.POI_ICON, "icon-tint" },
            { FeatureAttributes.POI_ADDED_IMAGES, new [] {"data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAUAAAAFCAYAAACNbyblAAAAHElEQVQI12P4//" +
                                                          "8/w38GIAXDIBKE0DHxgljNBAAO9TXL0Y4OHwAAAABJRU5ErkJggg=="} }
        });
        _imagesUrlsStorageExecutor.GetImageUrlIfExists(Arg.Any<MD5>(), Arg.Any<byte[]>()).Returns((string)null);
        gateway.GetNode(42).Returns(new Node { Tags = new TagsCollection()
        {
            {"natural", "spring"}
        }, Latitude = 0, Longitude = 0, Id = 42 });

        _adapter.UpdateFeature(poi, gateway, Languages.HEBREW).Wait();

        _wikimediaCommonGateway.Received(1).UploadImage("tint.png", "tint", user.DisplayName, Arg.Any<Stream>(), Arg.Any<Coordinate>());
        _wikimediaCommonGateway.Received(1).GetImageUrl(Arg.Any<string>());
        _imagesUrlsStorageExecutor.Received(1).StoreImage(Arg.Any<MD5>(), Arg.Any<byte[]>(), Arg.Any<string>());
    }

    [TestMethod]
    public void UpdateFeature_WithImageInRepository_ShouldNotUploadImage()
    {
        var user = new User { DisplayName = "DisplayName" };
        var gateway = SetupOsmAuthClient();
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
        gateway.GetNode(42).Returns(new Node { Tags = new TagsCollection { { "osmish", "something" } }, Latitude = 0, Longitude = 0, Id = 42 });

        _adapter.UpdateFeature(poi, gateway, Languages.HEBREW).Wait();

        _wikimediaCommonGateway.DidNotReceive().UploadImage(Arg.Any<string>(), Arg.Any<string>(), Arg.Any<string>(), Arg.Any<Stream>(), Arg.Any<Coordinate>());
        _wikimediaCommonGateway.DidNotReceive().GetImageUrl(Arg.Any<string>());
        gateway.Received().UpdateElement(Arg.Any<long>(), Arg.Is<ICompleteOsmGeo>(o => o.Tags.Any(t => t.Key == "image")));
    }

    [TestMethod]
    public void UpdateFeature_NewTitleDescriptionUrlsLocation_ShouldUpdateInOSM()
    {
        var user = new User { DisplayName = "DisplayName" };
        var gateway = SetupOsmAuthClient();
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
        gateway.GetNode(42).Returns(new Node { Tags = new TagsCollection { { "osmish", "something" } }, Latitude = 0, Longitude = 0, Id = 42 });

        _adapter.UpdateFeature(poi, gateway, Languages.HEBREW).Wait();

        _wikimediaCommonGateway.DidNotReceive().UploadImage(Arg.Any<string>(), Arg.Any<string>(), Arg.Any<string>(), Arg.Any<Stream>(), Arg.Any<Coordinate>());
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
        var gateway = SetupOsmAuthClient();
        gateway.GetUserDetails().Returns(user);
        const string id = "Node_42";
        var poi = new Feature(new Point(0, 0), new AttributesTable {
            { FeatureAttributes.POI_SOURCE, Sources.OSM },
            { FeatureAttributes.ID, id },
            { FeatureAttributes.POI_ICON, "icon" },
            { FeatureAttributes.POI_ADDED_URLS, new [] { "some-url" } }
        });
        gateway.GetNode(42).Returns(new Node { Tags = new TagsCollection { { "website", "some-url" } }, Latitude = 0, Longitude = 0, Id = 42 });

        _adapter.UpdateFeature(poi, gateway, Languages.HEBREW).Wait();

        _wikimediaCommonGateway.DidNotReceive().UploadImage(Arg.Any<string>(), Arg.Any<string>(), Arg.Any<string>(), Arg.Any<Stream>(), Arg.Any<Coordinate>());
        _wikimediaCommonGateway.DidNotReceive().GetImageUrl(Arg.Any<string>());
        gateway.DidNotReceive().UpdateElement(Arg.Any<long>(), Arg.Any<ICompleteOsmGeo>());
    }

    [TestMethod]
    public void UpdateFeature_IconChange_ShouldUpdateInOSM()
    {
        var user = new User { DisplayName = "DisplayName" };
        var gateway = SetupOsmAuthClient();
        gateway.GetUserDetails().Returns(user);
        const string id = "Node_42";
        var poi = new Feature(new Point(0, 0), new AttributesTable {
            { FeatureAttributes.POI_SOURCE, Sources.OSM },
            { FeatureAttributes.ID, id },
            { FeatureAttributes.POI_ICON, "icon-ruins" },
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
        var gateway = SetupOsmAuthClient();
        gateway.GetUserDetails().Returns(user);
        var id = "Node_42";
        var poi = new Feature(new Point(0, 0), new AttributesTable {
            { FeatureAttributes.POI_SOURCE, Sources.OSM },
            { FeatureAttributes.ID, id },
            { FeatureAttributes.POI_ICON, "icon-ruins" },
            { FeatureAttributes.POI_REMOVED_URLS, new [] { "url-to-remove" } }
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
        var gateway = SetupOsmAuthClient();
        gateway.GetUserDetails().Returns(user);
        var id = "Node_42";
        var poi = new Feature(new Point(0, 0), new AttributesTable {
            { FeatureAttributes.POI_SOURCE, Sources.OSM },
            { FeatureAttributes.ID, id },
            { FeatureAttributes.POI_ICON, "icon-ruins" },
            { FeatureAttributes.POI_REMOVED_URLS, new [] { "https://he.wikipedia.org/wiki/123" } }
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
        var gateway = SetupOsmAuthClient();
        gateway.GetUserDetails().Returns(user);
        var id = "Node_42";
        var poi = new Feature(new Point(0, 0), new AttributesTable {
            { FeatureAttributes.POI_SOURCE, Sources.OSM },
            { FeatureAttributes.ID, id },
            { FeatureAttributes.POI_ICON, "icon-ruins" },
            { FeatureAttributes.POI_REMOVED_URLS, new [] { "https://he.wikipedia.org/wiki/123" } }
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
        var gateway = SetupOsmAuthClient();
        gateway.GetUserDetails().Returns(user);
        var id = "Node_42";
        var poi = new Feature(new Point(0, 0), new AttributesTable {
            { FeatureAttributes.POI_SOURCE, Sources.OSM },
            { FeatureAttributes.ID, id },
            { FeatureAttributes.POI_ICON, "icon-ruins" },
            { FeatureAttributes.POI_REMOVED_IMAGES, new [] { "image-to-remove" } }
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
}