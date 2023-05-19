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
using System.IO;
using System.Linq;
using IsraelHiking.Common;
using IsraelHiking.Common.Extensions;
using NetTopologySuite.Geometries;

namespace IsraelHiking.API.Tests.Services.Osm
{
    [TestClass]
    public class DatabasesUpdaterServiceTests
    {
        private IDatabasesUpdaterService _service;
        private IClientsFactory _clientsFactory;
        private INonAuthClient _osmGateway;
        private IOsmRepository _osmRepository;
        private IExternalSourcesRepository _externalSourcesRepository;
        private IPointsOfInterestRepository _pointsOfInterestRepository;
        private IHighwaysRepository _highwaysRepository;
        private IOsmGeoJsonPreprocessorExecutor _geoJsonPreprocessorExecutor;
        private IFeaturesMergeExecutor _featuresMergeExecutor;
        private IOsmLatestFileGateway _osmLatestFileGateway;
        private IPointsOfInterestFilesCreatorExecutor _pointsOfInterestFilesCreatorExecutor;
        private IPointsOfInterestAdapterFactory _pointsOfInterestAdapterFactory;
        private IPointsOfInterestProvider _pointsOfInterestProvider;
        private IExternalSourceUpdaterExecutor _externalSourceUpdaterExecutor;
        private IImagesUrlsStorageExecutor _imagesUrlsStorageExecutor;
        private IElevationGateway _elevationGateway;
        
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
            _highwaysRepository = Substitute.For<IHighwaysRepository>();
            _osmRepository = Substitute.For<IOsmRepository>();
            _geoJsonPreprocessorExecutor = Substitute.For<IOsmGeoJsonPreprocessorExecutor>();
            _featuresMergeExecutor = Substitute.For<IFeaturesMergeExecutor>();
            _osmLatestFileGateway = Substitute.For<IOsmLatestFileGateway>();
            _pointsOfInterestFilesCreatorExecutor = Substitute.For<IPointsOfInterestFilesCreatorExecutor>();
            _pointsOfInterestAdapterFactory = Substitute.For<IPointsOfInterestAdapterFactory>();
            _pointsOfInterestProvider = Substitute.For<IPointsOfInterestProvider>();
            _externalSourceUpdaterExecutor = Substitute.For<IExternalSourceUpdaterExecutor>();
            _imagesUrlsStorageExecutor = Substitute.For<IImagesUrlsStorageExecutor>();
            _elevationGateway = Substitute.For<IElevationGateway>();
            _service = new DatabasesUpdaterService(_externalSourcesRepository,
                _pointsOfInterestRepository,
                _highwaysRepository,
                _geoJsonPreprocessorExecutor,
                _osmRepository,
                _pointsOfInterestAdapterFactory,
                _featuresMergeExecutor,
                _osmLatestFileGateway,
                _pointsOfInterestFilesCreatorExecutor,
                _imagesUrlsStorageExecutor,
                _pointsOfInterestProvider,
                _externalSourceUpdaterExecutor,
                _elevationGateway,
                Substitute.For<IUnauthorizedImageUrlsRemover>(),
                Substitute.For<ILogger>());
        }

        [TestMethod]
        public void TestRebuild_ExternalSources_ShouldRebuildExternalSources()
        {
            _pointsOfInterestAdapterFactory.GetAll().Returns(new[] {Substitute.For<IPointsOfInterestAdapter>()});
            
            _service.Rebuild(new UpdateRequest {AllExternalSources = true}).Wait();

            _externalSourceUpdaterExecutor.Received(1).UpdateSource(Arg.Any<string>());
            _pointsOfInterestRepository.StoreRebuildContext(Arg.Is<RebuildContext>(c => c.Succeeded == true));
        }
        
        [TestMethod]
        public void TestRebuild_Highways_ShouldRebuildHighwaysAndPoints()
        { 
            _service.Rebuild(new UpdateRequest {Highways = true}).Wait();

            _highwaysRepository.Received(1).UpdateHighwaysZeroDownTime(Arg.Any<List<IFeature>>());
            _pointsOfInterestRepository.StoreRebuildContext(Arg.Is<RebuildContext>(c => c.Succeeded == true));
        }

        [TestMethod] public void TestRebuild_Points_ShouldRebuildPointsWhileMarkingOneAsDeleted()
        {
            var adapter = Substitute.For<IPointsOfInterestAdapter>();
            adapter.GetAll().Returns(new List<IFeature>());
            _pointsOfInterestAdapterFactory.GetAll().Returns(new[] {adapter});
            _externalSourcesRepository.GetExternalPoisBySource(Arg.Any<string>()).Returns(new List<IFeature>());
            var feature = new Feature(new Point(0, 0), new AttributesTable
            {
                {FeatureAttributes.NAME, "feature in database that needs to be deleted"},
                {FeatureAttributes.POI_ID, "42"}
            });
            feature.SetLastModified(new DateTime(0));
            _pointsOfInterestRepository.GetAllPointsOfInterest(Arg.Any<bool>()).Returns(new List<IFeature> {feature});
            _pointsOfInterestRepository.GetPointsOfInterestUpdates(Arg.Any<DateTime>(), Arg.Any<DateTime>()).Returns(new List<IFeature>());
            _featuresMergeExecutor.Merge(Arg.Any<List<IFeature>>(), Arg.Any<List<IFeature>>()).Returns(new List<IFeature>
            {
                new Feature(new Point(0,0), new AttributesTable { {FeatureAttributes.POI_ID, "1"}})
            });
            _pointsOfInterestProvider.GetAll().Returns(new List<IFeature>());
            
            _service.Rebuild(new UpdateRequest {PointsOfInterest = true}).Wait();
            
            _pointsOfInterestRepository.Received(2).StorePointsOfInterestDataToSecondaryIndex(Arg.Any<List<IFeature>>());
            _pointsOfInterestRepository.Received(1).StorePointsOfInterestDataToSecondaryIndex(Arg.Is<List<IFeature>>(l => l.Any(f => f.Attributes.Exists(FeatureAttributes.POI_DELETED))));
            _pointsOfInterestRepository.Received(1).SwitchPointsOfInterestIndices();
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
            _pointsOfInterestRepository.GetAllPointsOfInterest(false).Returns(new List<IFeature> {feature});
            _osmRepository.GetImagesUrls(Arg.Any<Stream>()).Returns(new List<string> {imageUrl});
            
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
        public void TestRebuild_OfflinePointsFile_ShouldRebuildIt()
        {
            var feature = new Feature(new Point(0, 0), new AttributesTable());
            feature.SetLastModified(new DateTime(0));
            _pointsOfInterestRepository.GetAllPointsOfInterest(false).Returns(new List<IFeature> {feature});
            _elevationGateway.GetElevation(Arg.Any<Coordinate[]>()).Returns(new[] {1.0});
            
            _service.Rebuild(new UpdateRequest {OfflinePoisFile = true}).Wait();

            _pointsOfInterestFilesCreatorExecutor.Received(1).CreateOfflinePoisFile(Arg.Any<List<IFeature>>());
            _pointsOfInterestRepository.StoreRebuildContext(Arg.Is<RebuildContext>(c => c.Succeeded == true));
        }
        
        [TestMethod]
        public void TestRebuild_GotException_ShouldStoreException()
        {
            _service.Rebuild(new UpdateRequest {OfflinePoisFile = true}).Wait();

            _pointsOfInterestRepository.StoreRebuildContext(Arg.Is<RebuildContext>(c => c.Succeeded == false));
        }
    }
}
