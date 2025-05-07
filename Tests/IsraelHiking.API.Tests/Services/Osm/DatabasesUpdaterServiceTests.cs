using IsraelHiking.API.Executors;
using IsraelHiking.API.Services.Osm;
using IsraelHiking.API.Services.Poi;
using IsraelHiking.Common.Api;
using IsraelHiking.Common.Configuration;
using IsraelHiking.DataAccessInterfaces;
using IsraelHiking.DataAccessInterfaces.Repositories;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using Microsoft.VisualStudio.TestTools.UnitTesting;
using NetTopologySuite.Features;
using NSubstitute;
using OsmSharp.IO.API;
using System;
using System.Collections.Generic;
using System.Linq;
using IsraelHiking.Common;
using IsraelHiking.Common.Extensions;
using NetTopologySuite.Geometries;

namespace IsraelHiking.API.Tests.Services.Osm;

[TestClass]
public class DatabasesUpdaterServiceTests
{
    private IDatabasesUpdaterService _service;
    private IClientsFactory _clientsFactory;
    private INonAuthClient _osmGateway;
    private IExternalSourcesRepository _externalSourcesRepository;
    private IPointsOfInterestRepository _pointsOfInterestRepository;
    private IPointsOfInterestFilesCreatorExecutor _pointsOfInterestFilesCreatorExecutor;
    private IPointsOfInterestAdapterFactory _pointsOfInterestAdapterFactory;
    private IExternalSourceUpdaterExecutor _externalSourceUpdaterExecutor;
    private IImagesUrlsStorageExecutor _imagesUrlsStorageExecutor;
    private IElevationGateway _elevationGateway;
    private IOverpassTurboGateway _overpassTurboGateway;
        
    [TestInitialize]
    public void TestInitialize()
    {
        _clientsFactory = Substitute.For<IClientsFactory>();
        _osmGateway = Substitute.For<INonAuthClient>();
        _clientsFactory.CreateNonAuthClient().Returns(_osmGateway);
        var options = new ConfigurationData();
        var optionsProvider = Substitute.For<IOptions<ConfigurationData>>();
        optionsProvider.Value.Returns(options);
        _externalSourcesRepository = Substitute.For<IExternalSourcesRepository>();
        _pointsOfInterestRepository = Substitute.For<IPointsOfInterestRepository>();
        _pointsOfInterestFilesCreatorExecutor = Substitute.For<IPointsOfInterestFilesCreatorExecutor>();
        _pointsOfInterestAdapterFactory = Substitute.For<IPointsOfInterestAdapterFactory>();
        _externalSourceUpdaterExecutor = Substitute.For<IExternalSourceUpdaterExecutor>();
        _imagesUrlsStorageExecutor = Substitute.For<IImagesUrlsStorageExecutor>();
        _elevationGateway = Substitute.For<IElevationGateway>();
        _overpassTurboGateway = Substitute.For<IOverpassTurboGateway>();
        _service = new DatabasesUpdaterService(_externalSourcesRepository,
            _pointsOfInterestRepository,
            _pointsOfInterestAdapterFactory,
            _pointsOfInterestFilesCreatorExecutor,
            _imagesUrlsStorageExecutor,
            _externalSourceUpdaterExecutor, Substitute.For<IElevationSetterExecutor>(),
            _overpassTurboGateway,
            Substitute.For<ILogger>());
    }

    [TestMethod]
    public void TestRebuild_ExternalSources_ShouldRebuildExternalSources()
    {
        _pointsOfInterestAdapterFactory.GetAll().Returns([Substitute.For<IPointsOfInterestAdapter>()]);
            
        _service.Rebuild(new UpdateRequest {AllExternalSources = true}).Wait();

        _externalSourceUpdaterExecutor.Received(1).UpdateSource(Arg.Any<string>());
        _pointsOfInterestRepository.StoreRebuildContext(Arg.Is<RebuildContext>(c => c.Succeeded == true));
    }
        
    [TestMethod]
    public void TestRebuild_Images_ShouldRebuildImages()
    {
        const string imageUrl = "imageUrl";
        var feature = new Feature(new Point(0, 0), new AttributesTable
        {
            {FeatureAttributes.IMAGE_URL, "imageUrl2"}
        });
        feature.SetLastModified(new DateTime(0));
        _pointsOfInterestRepository.GetAllPointsOfInterest().Returns([feature]);
        _overpassTurboGateway.GetImagesUrls().Returns([imageUrl]);
            
        _service.Rebuild(new UpdateRequest {Images = true}).Wait();

        _imagesUrlsStorageExecutor.Received(1).DownloadAndStoreUrls(Arg.Is<List<string>>(l => l.All(i => i.StartsWith(imageUrl))));
        _pointsOfInterestRepository.StoreRebuildContext(Arg.Is<RebuildContext>(c => c.Succeeded == true));
    }
        
    [TestMethod]
    public void TestRebuild_SiteMap_ShouldRebuildSiteMap()
    {
        _service.Rebuild(new UpdateRequest {SiteMap = true}).Wait();

        _pointsOfInterestFilesCreatorExecutor.Received(1).CreateSiteMapXmlFile(Arg.Any<List<IFeature>>());
        _pointsOfInterestRepository.StoreRebuildContext(Arg.Is<RebuildContext>(c => c.Succeeded == true));
    }
        
    [TestMethod]
    public void TestRebuild_OfflinePointsFile_NoExternalFeatures()
    {
        var feature = new Feature(new Point(0, 0), new AttributesTable());
        _pointsOfInterestRepository.GetAllPointsOfInterest().Returns([feature]);
        _elevationGateway.GetElevation(Arg.Any<Coordinate[]>()).Returns([1.0]);
        _pointsOfInterestAdapterFactory.GetAll().Returns([]);
            
        _service.Rebuild(new UpdateRequest {OfflinePoisFile = true}).Wait();

        _pointsOfInterestFilesCreatorExecutor.Received(1).CreateExtenalPoisFile(Arg.Any<List<IFeature>>());
        _pointsOfInterestRepository.StoreRebuildContext(Arg.Is<RebuildContext>(c => c.Succeeded == true));
    }
        
    [TestMethod]
    public void TestRebuild_OfflinePointsFileNoRelevantSource_ShouldRebuildIt()
    {
        var feature = new Feature(new Point(0, 0), new AttributesTable());
        _pointsOfInterestRepository.GetAllPointsOfInterest().Returns([feature]);
        _elevationGateway.GetElevation(Arg.Any<Coordinate[]>()).Returns([1.0]);
        var adapter = Substitute.For<IPointsOfInterestAdapter>();
        adapter.Source.Returns(Sources.NAKEB);
        _pointsOfInterestAdapterFactory.GetAll().Returns([adapter]);
        _externalSourcesRepository.GetExternalPoisBySource(Arg.Any<string>()).Returns([feature]);
        _overpassTurboGateway.GetExternalReferences().Returns(new Dictionary<string, List<string>> { { Sources.WIKIDATA,
            ["Q123"]
        }});
            
        _service.Rebuild(new UpdateRequest {OfflinePoisFile = true}).Wait();

        _pointsOfInterestFilesCreatorExecutor.Received(1).CreateExtenalPoisFile(Arg.Any<List<IFeature>>());
        _pointsOfInterestRepository.StoreRebuildContext(Arg.Is<RebuildContext>(c => c.Succeeded == true));
    }
        
    [TestMethod]
    public void TestRebuild_OfflinePointsFile_ShouldRebuildItWithoutReferncedFeatures()
    {
        var feature1 = new Feature(new Point(0, 0), new AttributesTable
        {
            { FeatureAttributes.ID, "Q111" },
            { FeatureAttributes.WIKIDATA, "Q111"}
        });
        var feature2 = new Feature(new Point(0, 0), new AttributesTable
        {
            { FeatureAttributes.NAME, "Q222" },
            { FeatureAttributes.WIKIDATA, "Q222"}
        });
        var feature3 = new Feature(new Point(0, 0), new AttributesTable
        {
            { FeatureAttributes.ID, "Q333" },
            { FeatureAttributes.WIKIDATA, "Q333"}
        });
        _pointsOfInterestRepository.GetAllPointsOfInterest().Returns([feature1]);
        _elevationGateway.GetElevation(Arg.Any<Coordinate[]>()).Returns([1.0]);
        var adapter = Substitute.For<IPointsOfInterestAdapter>();
        adapter.Source.Returns(Sources.WIKIDATA);
        _pointsOfInterestAdapterFactory.GetAll().Returns([adapter]);
        _externalSourcesRepository.GetExternalPoisBySource(Arg.Any<string>()).Returns([feature1, feature2, feature3]);
        _overpassTurboGateway.GetExternalReferences().Returns(new Dictionary<string, List<string>> { { Sources.WIKIDATA,
            ["Q111", "Q222"]
        }});
            
        _service.Rebuild(new UpdateRequest {OfflinePoisFile = true}).Wait();

        _pointsOfInterestFilesCreatorExecutor.Received(1).CreateExtenalPoisFile(Arg.Is<List<IFeature>>(a => a.Count == 1));
        _pointsOfInterestRepository.StoreRebuildContext(Arg.Is<RebuildContext>(c => c.Succeeded == true));
    }
        
    [TestMethod]
    public void TestRebuild_GotException_ShouldStoreException()
    {
        _service.Rebuild(new UpdateRequest {OfflinePoisFile = true}).Wait();

        _pointsOfInterestRepository.StoreRebuildContext(Arg.Is<RebuildContext>(c => c.Succeeded == false));
    }
}