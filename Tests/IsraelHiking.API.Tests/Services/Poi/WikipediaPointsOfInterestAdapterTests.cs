using System;
using System.Collections.Generic;
using GeoAPI.Geometries;
using IsraelHiking.API.Executors;
using IsraelHiking.API.Services;
using IsraelHiking.API.Services.Poi;
using IsraelHiking.Common;
using IsraelHiking.DataAccessInterfaces;
using Microsoft.Extensions.Logging;
using Microsoft.VisualStudio.TestTools.UnitTesting;
using NetTopologySuite.Features;
using NSubstitute;

namespace IsraelHiking.API.Tests.Services.Poi
{
    [TestClass]
    public class WikipediaPointsOfInterestAdapterTests : BasePointsOfInterestAdapterTestsHelper
    {
        private WikipediaPointsOfInterestAdapter _adapter;
        private IWikipediaGateway _wikipediaGateway;
        private IElevationDataStorage _elevationDataStorage;
        private IElasticSearchGateway _elasticSearchGateway;
        private IRemoteFileFetcherGateway _remoteFileFetcherGateway;
        private IDataContainerConverterService _dataContainerConverterService;

        [TestInitialize]
        public void TestInialize()
        {
            _wikipediaGateway = Substitute.For<IWikipediaGateway>();
            _elevationDataStorage = Substitute.For<IElevationDataStorage>();
            _elasticSearchGateway = Substitute.For<IElasticSearchGateway>();
            _dataContainerConverterService = Substitute.For<IDataContainerConverterService>();
            var factory = Substitute.For<IHttpGatewayFactory>();
            _remoteFileFetcherGateway = Substitute.For<IRemoteFileFetcherGateway>();
            factory.CreateRemoteFileFetcherGateway(null).Returns(_remoteFileFetcherGateway);
            _adapter = new WikipediaPointsOfInterestAdapter(_elevationDataStorage, _elasticSearchGateway, _dataContainerConverterService, _wikipediaGateway, factory, new ItmWgs84MathTransfromFactory(), Substitute.For<ILogger>());
        }

        [TestMethod]
        public void GetPointsOfInterest_ShouldReturnEmptyList()
        {
            Assert.AreEqual(0, _adapter.GetPointsOfInterest(null, null, null, null).Result.Length);
        }

        [TestMethod]
        public void GetPointOfInterestById_ShouldGetIt()
        {
            var poiId = "42";
            var language = "en";
            var featureCollection = new FeatureCollection
            {
                Features = { GetValidFeature(poiId, _adapter.Source) }
            };
            _dataContainerConverterService.ToDataContainer(Arg.Any<byte[]>(), Arg.Any<string>()).Returns(new DataContainer { Routes = new List<RouteData>() });

            _wikipediaGateway.GetById("42").Returns(featureCollection);

            var results = _adapter.GetPointOfInterestById(poiId, language).Result;

            Assert.IsNotNull(results);
            Assert.IsNotNull(results.SourceImageUrl);
            Assert.IsFalse(results.IsEditable);
            _elevationDataStorage.Received().GetElevation(Arg.Any<Coordinate>());
            _elasticSearchGateway.Received().GetRating(poiId, Arg.Any<string>());
        }

        [TestMethod]
        public void AddPointOfInterest_ShouldThrow()
        {
            Assert.ThrowsException<Exception>(() => _adapter.AddPointOfInterest(null, null, null).Result);
        }

        [TestMethod]
        public void UpdatePointOfInterest_ShouldThrow()
        {
            Assert.ThrowsException<Exception>(() => _adapter.UpdatePointOfInterest(null, null, null).Result);
        }

        [TestMethod]
        public void GetPointsForIndexing_ShouldGetAllPointsFromGateway()
        {
            _wikipediaGateway.GetByLocation(Arg.Any<Coordinate>(), Arg.Any<string>()).Returns(new List<Feature> {GetValidFeature("1", Sources.WIKIPEDIA)});
            var points = _adapter.GetPointsForIndexing(null).Result;

            _wikipediaGateway.Received(1092).GetByLocation(Arg.Any<Coordinate>(), Arg.Any<string>());
            Assert.AreEqual(1, points.Count); // only 1 distinct
        }

    }
}
