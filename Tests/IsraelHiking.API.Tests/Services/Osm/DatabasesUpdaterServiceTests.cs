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
            _service = new DatabasesUpdaterService(_externalSourcesRepository,
                _pointsOfInterestRepository,
                _highwaysRepository,
                _geoJsonPreprocessorExecutor,
                _osmRepository,
                _pointsOfInterestAdapterFactory,
                _featuresMergeExecutor,
                _osmLatestFileGateway,
                _pointsOfInterestFilesCreatorExecutor,
                null,
                _pointsOfInterestProvider,
                null,
                null,
                Substitute.For<ILogger>());
        }

        [TestMethod]
        public void TestRebuild_ShouldRebuildHighwaysAndPoints()
        {
            var adapter = Substitute.For<IPointsOfInterestAdapter>();
            adapter.GetAll().Returns(new List<Feature>());
            _pointsOfInterestAdapterFactory.GetBySource(Arg.Any<string>()).Returns(adapter);
            _externalSourcesRepository.GetExternalPoisBySource(Arg.Any<string>()).Returns(new List<Feature>());
            _pointsOfInterestRepository.GetAllPointsOfInterest(Arg.Any<bool>()).Returns(new List<Feature>());
            _pointsOfInterestRepository.GetPointsOfInterestUpdates(Arg.Any<DateTime>(), Arg.Any<DateTime>()).Returns(new List<Feature>());
            _featuresMergeExecutor.Merge(Arg.Any<List<Feature>>(), Arg.Any<List<Feature>>()).Returns(new List<Feature>());
            _pointsOfInterestProvider.GetAll().Returns(new List<Feature>());
            
            _service.Rebuild(new UpdateRequest { Highways = true, PointsOfInterest = true, SiteMap = true }).Wait();

            _highwaysRepository.Received(1).UpdateHighwaysZeroDownTime(Arg.Any<List<Feature>>());
            _pointsOfInterestRepository.Received(2).StorePointsOfInterestDataToSecondaryIndex(Arg.Any<List<Feature>>());
            _pointsOfInterestRepository.Received(1).SwitchPointsOfInterestIndices();
            _pointsOfInterestFilesCreatorExecutor.Received(1).CreateSiteMapXmlFile(Arg.Any<List<Feature>>());
        }
    }
}
