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
    public class OffRoadPointsOfInterestAdapterTests : BasePointsOfInterestAdapterTestsHelper
    {
        private OffRoadPointsOfInterestAdapter _adapter;
        private IOffRoadGateway _offRoadGateway;

        [TestInitialize]
        public void TestInialize()
        {
            InitializeSubstitues();
            _offRoadGateway = Substitute.For<IOffRoadGateway>();
            _adapter = new OffRoadPointsOfInterestAdapter(_elevationDataStorage, _elasticSearchGateway, _offRoadGateway, _dataContainerConverterService, _itmWgs84MathTransfromFactory, _options, Substitute.For<ILogger>());
        }

        [TestMethod]
        public void GetPointOfInterestById_ShouldGetIt()
        {
            var poiId = "42";
            var language = "en";
            var featureCollection = new FeatureCollection
            {
                Features = {GetValidFeature(poiId, _adapter.Source)}
            };
            _dataContainerConverterService.ToDataContainer(Arg.Any<byte[]>(), Arg.Any<string>()).Returns(new DataContainer {Routes = new List<RouteData>()});

            _offRoadGateway.GetById("42").Returns(featureCollection);

            var results = _adapter.GetPointOfInterestById(poiId, language).Result;

            Assert.IsNotNull(results);
            Assert.AreEqual(0, results.References.Length);
            Assert.IsFalse(results.IsEditable);
            _elevationDataStorage.Received().GetElevation(Arg.Any<Coordinate>());
            _elasticSearchGateway.Received().GetRating(poiId, Arg.Any<string>());
        }

        [TestMethod]
        public void GetPointsForIndexing_ShouldGetAllPointsFromGateway()
        {
            var featuresList = new List<Feature> { new Feature(null, null) };
            _offRoadGateway.GetAll().Returns(featuresList);

            var points = _adapter.GetPointsForIndexing().Result;

            Assert.AreEqual(featuresList.Count, points.Count);
        }
    }
}
