using System.Collections.Generic;
using System.IO;
using IsraelHiking.API.Executors;
using IsraelHiking.API.Services;
using IsraelHiking.API.Services.Osm;
using IsraelHiking.API.Services.Poi;
using IsraelHiking.Common;
using IsraelHiking.DataAccessInterfaces;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using Microsoft.VisualStudio.TestTools.UnitTesting;
using NetTopologySuite.Features;
using NSubstitute;
using OsmSharp;
using OsmSharp.Changesets;
using OsmSharp.Complete;

namespace IsraelHiking.API.Tests.Services.Osm
{
    [TestClass]
    public class OsmElasticSearchUpdaterServiceTests
    {
        private IElasticSearchUpdaterService _service;
        private IHttpGatewayFactory _httpGatewayFactory;
        private IOsmRepository _osmRepository;
        private IElasticSearchGateway _elasticSearchGateway;
        private IOsmGeoJsonPreprocessorExecutor _geoJsonPreprocessorExecutor;
        private IFeaturesMergeExecutor _featuresMergeExecutor;
        private IGraphHopperGateway _graphHopperGateway;
        private IOsmLatestFileFetcherExecutor _osmLatestFileFetcherExecutor;

        [TestInitialize]
        public void TestInitialize()
        {
            _httpGatewayFactory = Substitute.For<IHttpGatewayFactory>();
            var options = new ConfigurationData();
            var optionsProvider = Substitute.For<IOptions<ConfigurationData>>();
            optionsProvider.Value.Returns(options);
            _elasticSearchGateway = Substitute.For<IElasticSearchGateway>();
            _osmRepository = Substitute.For<IOsmRepository>();
            _geoJsonPreprocessorExecutor = Substitute.For<IOsmGeoJsonPreprocessorExecutor>();
            _featuresMergeExecutor = Substitute.For<IFeaturesMergeExecutor>();
            _graphHopperGateway = Substitute.For<IGraphHopperGateway>();
            _osmLatestFileFetcherExecutor = Substitute.For<IOsmLatestFileFetcherExecutor>();
            _service = new ElasticSearchUpdaterService(_httpGatewayFactory, _elasticSearchGateway, _geoJsonPreprocessorExecutor, new TagsHelper(optionsProvider), _osmRepository, new IPointsOfInterestAdapter[0], _featuresMergeExecutor, _osmLatestFileFetcherExecutor, _graphHopperGateway, Substitute.For<ILogger>());
        }

        [TestMethod]
        public void TestRebuild_ShouldRebuildHighwaysAndPoints()
        {
            _service.Rebuild(new UpdateRequest { Highways = true, PointsOfInterest = true }).Wait();

            _elasticSearchGateway.Received(1).UpdateHighwaysZeroDownTime(Arg.Any<List<Feature>>());
            _elasticSearchGateway.Received(1).UpdatePointsOfInterestZeroDownTime(Arg.Any<List<Feature>>());
        }

        [TestMethod]
        public void TestUpdate_EmptyOsmChangeFile_ShouldNotUpdateAnything()
        {
            var changes = new OsmChange {Create = new OsmGeo[0], Modify = new OsmGeo[0], Delete = new OsmGeo[0]};
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

        
    }
}
