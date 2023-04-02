using System;
using System.Collections.Generic;
using IsraelHiking.API.Executors;
using IsraelHiking.API.Services.Poi;
using IsraelHiking.Common.Extensions;
using IsraelHiking.DataAccessInterfaces;
using IsraelHiking.DataAccessInterfaces.Repositories;
using Microsoft.Extensions.Logging;
using Microsoft.VisualStudio.TestTools.UnitTesting;
using NetTopologySuite.Features;
using NetTopologySuite.Geometries;
using NSubstitute;

namespace IsraelHiking.API.Tests.Executors
{
    [TestClass]
    public class ExternalSourceUpdaterExecutorTests
    {
        private ExternalSourceUpdaterExecutor _executor;
        private IPointsOfInterestAdapterFactory _pointsOfInterestAdapterFactory;
        private IElevationGateway _elevationGateway;
        private IExternalSourcesRepository _externalSourcesRepository;
        
        [TestInitialize]
        public void TestInitialize()
        {
            _pointsOfInterestAdapterFactory = Substitute.For<IPointsOfInterestAdapterFactory>();
            _elevationGateway = Substitute.For<IElevationGateway>();
            _externalSourcesRepository = Substitute.For<IExternalSourcesRepository>();
            _executor = new ExternalSourceUpdaterExecutor(_pointsOfInterestAdapterFactory, 
                _elevationGateway,
                _externalSourcesRepository, 
                Substitute.For<ILogger>());
        }

        [TestMethod]
        public void UpdateSource_NoPreviousPoints_ShouldUpdate()
        {
            const string sourceName = "sourceName";
            var adapter = Substitute.For<IPointsOfInterestAdapter>();
            adapter.GetUpdates(Arg.Any<DateTime>()).Returns(new List<IFeature>());
            _pointsOfInterestAdapterFactory.GetBySource(sourceName).Returns(adapter);
            _externalSourcesRepository.GetExternalPoisBySource(sourceName).Returns(new List<IFeature>());
            
            _executor.UpdateSource(sourceName).Wait();

            _externalSourcesRepository.Received(1).AddExternalPois(Arg.Any<List<IFeature>>());
        }
        
        [TestMethod]
        public void UpdateSource_UseLastModified_ShouldUpdate()
        {
            const string sourceName = "sourceName";
            var feature = new Feature(new Point(0, 0), new AttributesTable());
            feature.SetLastModified(new DateTime(0));
            var adapter = Substitute.For<IPointsOfInterestAdapter>();
            adapter.GetUpdates(Arg.Any<DateTime>()).Returns(new List<IFeature>());
            _pointsOfInterestAdapterFactory.GetBySource(sourceName).Returns(adapter);
            _externalSourcesRepository.GetExternalPoisBySource(sourceName).Returns(new List<IFeature> {feature});
            
            _executor.UpdateSource(sourceName).Wait();

            _externalSourcesRepository.Received(1).AddExternalPois(Arg.Any<List<IFeature>>());
        }

        [TestMethod]
        public void RebuildSource_ShouldRebuild()
        {
            const string sourceName = "sourceName";
            var adapter = Substitute.For<IPointsOfInterestAdapter>();
            var feature = new Feature(new Point(0, 0), new AttributesTable());
            feature.SetLocation(new Coordinate(0,0));
            adapter.GetAll().Returns(new List<IFeature> { feature});
            _elevationGateway.GetElevation(Arg.Any<Coordinate[]>()).Returns(new [] {0.0});
            _pointsOfInterestAdapterFactory.GetBySource(sourceName).Returns(adapter);

            _executor.RebuildSource(sourceName).Wait();
            
            _externalSourcesRepository.Received(1).DeleteExternalPoisBySource(sourceName);
            _externalSourcesRepository.Received(1).AddExternalPois(Arg.Any<List<IFeature>>());
        }
    }
}