using IsraelHiking.API.Executors;
using IsraelHiking.API.Services;
using IsraelHiking.API.Services.Osm;
using IsraelHiking.API.Services.Poi;
using IsraelHiking.Common;
using IsraelHiking.Common.Api;
using IsraelHiking.Common.Configuration;
using IsraelHiking.Common.Extensions;
using IsraelHiking.DataAccessInterfaces;
using IsraelHiking.DataAccessInterfaces.Repositories;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using Microsoft.VisualStudio.TestTools.UnitTesting;
using NetTopologySuite.Features;
using NetTopologySuite.Geometries;
using NSubstitute;
using OsmSharp;
using OsmSharp.Changesets;
using OsmSharp.Complete;
using OsmSharp.IO.API;
using OsmSharp.Tags;
using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Xml.Serialization;

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
            _service = new DatabasesUpdaterService(_clientsFactory,
                _externalSourcesRepository,
                _pointsOfInterestRepository,
                _highwaysRepository,
                _geoJsonPreprocessorExecutor,
                new TagsHelper(optionsProvider),
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

        [TestMethod]
        public void TestUpdate_EmptyOsmChangeFile_ShouldNotUpdateAnything()
        {
            var changes = new OsmChange { Create = new OsmGeo[0], Modify = new OsmGeo[0], Delete = new OsmGeo[0] };
            _geoJsonPreprocessorExecutor
                .Preprocess(Arg.Is<List<ICompleteOsmGeo>>(x => x.Count == 0))
                .Returns(new List<Feature>());
            _geoJsonPreprocessorExecutor
                .Preprocess(Arg.Is<List<CompleteWay>>(x => x.Count == 0))
                .Returns(new List<Feature>());
            _osmLatestFileGateway.GetUpdates().Returns(CreateStream(changes));

            _service.Update().Wait();

            _pointsOfInterestRepository.Received(1).UpdatePointsOfInterestData(Arg.Is<List<Feature>>(x => x.Count == 0));
            _highwaysRepository.Received(1).UpdateHighwaysData(Arg.Is<List<Feature>>(x => x.Count == 0));
        }

        [TestMethod]
        public void TestUpdate_OsmChangeFileWithDeletion_ShouldDeleteFromDatabase()
        {
            var changes = new OsmChange
            {
                Create = new OsmGeo[0],
                Modify = new OsmGeo[0],
                Delete = new OsmGeo[] {
            new Way() { Id = 1, Tags = new TagsCollection { { "highway", "track" } } } }
            };
            _geoJsonPreprocessorExecutor
                .Preprocess(Arg.Is<List<ICompleteOsmGeo>>(x => x.Count == 0))
                .Returns(new List<Feature>());
            _geoJsonPreprocessorExecutor
                .Preprocess(Arg.Is<List<CompleteWay>>(x => x.Count == 0))
                .Returns(new List<Feature>());
            _osmLatestFileGateway.GetUpdates().Returns(CreateStream(changes));

            _service.Update().Wait();

            _highwaysRepository.Received(1).DeleteHighwaysById("way_1");
            _pointsOfInterestRepository.Received(1).DeleteOsmPointOfInterestById("way_1", Arg.Any<DateTime?>());
        }

        [TestMethod]
        public void TestUpdate_OsmChangeFileWithModification_ShouldUpdateDatabase()
        {
            var way = new CompleteWay()
            {
                Id = 1,
                Tags = new TagsCollection { { "highway", "track" }, { "route", "bicycle" } },
                Nodes = new Node[0]
            };
            var changes = new OsmChange
            {
                Create = new OsmGeo[0],
                Modify = new OsmGeo[] { way.ToSimple() },
                Delete = new OsmGeo[0]
            };
            var list = new List<Feature> { new Feature(new LineString(new Coordinate[0]), new AttributesTable()) };
            _geoJsonPreprocessorExecutor
                .Preprocess(Arg.Is<List<ICompleteOsmGeo>>(x => x.Count == 1))
                    .Returns(list);
            _geoJsonPreprocessorExecutor
                .Preprocess(Arg.Is<List<CompleteWay>>(x => x.Count == 1))
                .Returns(list);
            _osmGateway.GetCompleteWay(1).Returns(way);
            _osmLatestFileGateway.GetUpdates().Returns(CreateStream(changes));

            _service.Update().Wait();

            _pointsOfInterestRepository.Received(1).UpdatePointsOfInterestData(Arg.Is<List<Feature>>(x => x.Count == 1));
            _highwaysRepository.Received(1).UpdateHighwaysData(Arg.Is<List<Feature>>(x => x.Count == 1));
        }

        [TestMethod]
        public void TestUpdate_OsmChangeFileWithModification_ShouldUpdateDatabaseUsingPoiPrefixFromDatabase()
        {
            var way = new CompleteWay()
            {
                Id = 1,
                Tags = new TagsCollection { { "highway", "track" }, { "route", "bicycle" } },
                Nodes = new Node[0]
            };
            var changes = new OsmChange
            {
                Create = new OsmGeo[0],
                Modify = new OsmGeo[] { way.ToSimple() },
                Delete = new OsmGeo[0]
            };
            var wayFeature = new Feature(new LineString(new Coordinate[0]), new AttributesTable {
                { FeatureAttributes.ID, "1" },
                { FeatureAttributes.POI_SOURCE, Sources.OSM }
            });
            wayFeature.SetId();
            var wayFeatureInDatabase = new Feature(new LineString(new Coordinate[0]), new AttributesTable {
                { FeatureAttributes.ID, "1" },
                { FeatureAttributes.POI_CATEGORY, Categories.HISTORIC },
                { FeatureAttributes.POI_SOURCE, Sources.OSM }
            });
            wayFeatureInDatabase.SetId();
            var list = new List<Feature> { wayFeature };
            _geoJsonPreprocessorExecutor
                .Preprocess(Arg.Is<List<ICompleteOsmGeo>>(x => x.Count == 1))
                    .Returns(list);
            _geoJsonPreprocessorExecutor
                .Preprocess(Arg.Is<List<CompleteWay>>(x => x.Count == 1))
                .Returns(list);
            _osmGateway.GetCompleteWay(1).Returns(way);
            _pointsOfInterestRepository.GetPointOfInterestById("way_1", Sources.OSM).Returns(wayFeatureInDatabase);
            _osmLatestFileGateway.GetUpdates().Returns(CreateStream(changes));

            _service.Update().Wait();

            _pointsOfInterestRepository.Received(1).UpdatePointsOfInterestData(Arg.Is<List<Feature>>(x => x.Count == 1 && x.First().Attributes.Exists(FeatureAttributes.POI_CATEGORY)));
        }

        private Stream CreateStream(OsmChange changes)
        {
            Stream stream = new MemoryStream();
            var serializer = new XmlSerializer(typeof(OsmChange));
            serializer.Serialize(stream, changes);
            stream.Seek(0, SeekOrigin.Begin);
            return stream;
        }
    }
}
