using IsraelHiking.API.Executors;
using IsraelHiking.API.Services;
using IsraelHiking.API.Services.Osm;
using IsraelHiking.API.Services.Poi;
using IsraelHiking.Common;
using IsraelHiking.Common.Extensions;
using IsraelHiking.DataAccessInterfaces;
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
using System.Collections.Generic;
using System.Linq;

namespace IsraelHiking.API.Tests.Services.Osm
{
    [TestClass]
    public class DatabasesUpdaterServiceTests
    {
        private IDatabasesUpdaterService _service;
        private IClientsFactory _clientsFactory;
        private INonAuthClient _osmGateway;
        private IOsmRepository _osmRepository;
        private IElasticSearchGateway _elasticSearchGateway;
        private IOsmGeoJsonPreprocessorExecutor _geoJsonPreprocessorExecutor;
        private IFeaturesMergeExecutor _featuresMergeExecutor;
        private IGraphHopperGateway _graphHopperGateway;
        private IOsmLatestFileFetcherExecutor _osmLatestFileFetcherExecutor;
        private IPointsOfInterestFilesCreatorExecutor _pointsOfInterestFilesCreatorExecutor;
        private IPointsOfInterestAdapterFactory _pointsOfInterestAdapterFactory;

        [TestInitialize]
        public void TestInitialize()
        {
            _clientsFactory = Substitute.For<IClientsFactory>();
            _osmGateway = Substitute.For<INonAuthClient>();
            _clientsFactory.CreateNonAuthClient().Returns(_osmGateway);
            var options = new ConfigurationData();
            var optionsProvider = Substitute.For<IOptions<ConfigurationData>>();
            optionsProvider.Value.Returns(options);
            _elasticSearchGateway = Substitute.For<IElasticSearchGateway>();
            _osmRepository = Substitute.For<IOsmRepository>();
            _geoJsonPreprocessorExecutor = Substitute.For<IOsmGeoJsonPreprocessorExecutor>();
            _featuresMergeExecutor = Substitute.For<IFeaturesMergeExecutor>();
            _graphHopperGateway = Substitute.For<IGraphHopperGateway>();
            _osmLatestFileFetcherExecutor = Substitute.For<IOsmLatestFileFetcherExecutor>();
            _pointsOfInterestFilesCreatorExecutor = Substitute.For<IPointsOfInterestFilesCreatorExecutor>();
            _pointsOfInterestAdapterFactory = Substitute.For<IPointsOfInterestAdapterFactory>();
            _service = new DatabasesUpdaterService(_clientsFactory, 
                _elasticSearchGateway, 
                _geoJsonPreprocessorExecutor, 
                new TagsHelper(optionsProvider), 
                _osmRepository, 
                _pointsOfInterestAdapterFactory, 
                _featuresMergeExecutor, 
                _osmLatestFileFetcherExecutor, 
                _graphHopperGateway,
                _pointsOfInterestFilesCreatorExecutor,
                null,
                Substitute.For<ILogger>());
        }

        [TestMethod]
        public void TestRebuild_ShouldRebuildHighwaysAndPoints()
        {
            var adapter = Substitute.For<IPointsOfInterestAdapter>();
            adapter.GetPointsForIndexing().Returns(new List<Feature>());
            _pointsOfInterestAdapterFactory.GetBySource(Arg.Any<string>()).Returns(adapter);
            _elasticSearchGateway.GetExternalPoisBySource(Arg.Any<string>()).Returns(new List<Feature>());
            _featuresMergeExecutor.Merge(Arg.Any<List<Feature>>()).Returns(new List<Feature>());

            _service.Rebuild(new UpdateRequest { Highways = true, PointsOfInterest = true, SiteMap = true }).Wait();

            _elasticSearchGateway.Received(1).UpdateHighwaysZeroDownTime(Arg.Any<List<Feature>>());
            _elasticSearchGateway.Received(1).UpdatePointsOfInterestZeroDownTime(Arg.Any<List<Feature>>());
            _pointsOfInterestFilesCreatorExecutor.Received(1).CreateSiteMapXmlFile(Arg.Any<List<Feature>>());
        }

        [TestMethod]
        public void TestUpdate_EmptyOsmChangeFile_ShouldNotUpdateAnything()
        {
            var changes = new OsmChange { Create = new OsmGeo[0], Modify = new OsmGeo[0], Delete = new OsmGeo[0] };
            _geoJsonPreprocessorExecutor
                .Preprocess(Arg.Is<Dictionary<string, List<ICompleteOsmGeo>>>(x => x.Values.Count == 0))
                .Returns(new List<Feature>());
            _geoJsonPreprocessorExecutor
                .Preprocess(Arg.Is<List<CompleteWay>>(x => x.Count == 0))
                .Returns(new List<Feature>());

            _service.Update(changes).Wait();

            _elasticSearchGateway.Received(1).UpdatePointsOfInterestData(Arg.Is<List<Feature>>(x => x.Count == 0));
            _elasticSearchGateway.Received(1).UpdateHighwaysData(Arg.Is<List<Feature>>(x => x.Count == 0));
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
                .Preprocess(Arg.Is<Dictionary<string, List<ICompleteOsmGeo>>>(x => x.Values.Count == 0))
                .Returns(new List<Feature>());
            _geoJsonPreprocessorExecutor
                .Preprocess(Arg.Is<List<CompleteWay>>(x => x.Count == 0))
                .Returns(new List<Feature>());

            _service.Update(changes).Wait();

            _elasticSearchGateway.Received(1).DeleteHighwaysById("way_1");
            _elasticSearchGateway.Received(1).DeleteOsmPointOfInterestById("way_1");
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
                .Preprocess(Arg.Is<Dictionary<string, List<ICompleteOsmGeo>>>(x => x.Values.Count == 1))
                    .Returns(list);
            _geoJsonPreprocessorExecutor
                .Preprocess(Arg.Is<List<CompleteWay>>(x => x.Count == 1))
                .Returns(list);
            _osmGateway.GetCompleteWay(1).Returns(way);

            _service.Update(changes).Wait();

            _elasticSearchGateway.Received(1).UpdatePointsOfInterestData(Arg.Is<List<Feature>>(x => x.Count == 1));
            _elasticSearchGateway.Received(1).UpdateHighwaysData(Arg.Is<List<Feature>>(x => x.Count == 1));
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
                .Preprocess(Arg.Is<Dictionary<string, List<ICompleteOsmGeo>>>(x => x.Values.Count == 1))
                    .Returns(list);
            _geoJsonPreprocessorExecutor
                .Preprocess(Arg.Is<List<CompleteWay>>(x => x.Count == 1))
                .Returns(list);
            _osmGateway.GetCompleteWay(1).Returns(way);
            _elasticSearchGateway.GetPointOfInterestById("way_1", Sources.OSM).Returns(wayFeatureInDatabase);

            _service.Update(changes).Wait();

            _elasticSearchGateway.Received(1).UpdatePointsOfInterestData(Arg.Is<List<Feature>>(x => x.Count == 1 && x.First().Attributes.Exists(FeatureAttributes.POI_CATEGORY)));
        }


    }
}
