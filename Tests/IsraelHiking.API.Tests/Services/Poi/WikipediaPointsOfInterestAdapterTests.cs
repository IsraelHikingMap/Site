using IsraelHiking.API.Services.Poi;
using IsraelHiking.Common;
using IsraelHiking.DataAccessInterfaces;
using Microsoft.Extensions.Logging;
using Microsoft.VisualStudio.TestTools.UnitTesting;
using NetTopologySuite.Features;
using NetTopologySuite.Geometries;
using NSubstitute;
using System.Collections.Generic;

namespace IsraelHiking.API.Tests.Services.Poi
{
    [TestClass]
    public class WikipediaPointsOfInterestAdapterTests : BasePointsOfInterestAdapterTestsHelper
    {
        private WikipediaPointsOfInterestAdapter _adapter;
        private IWikipediaGateway _wikipediaGateway;

        [TestInitialize]
        public void TestInialize()
        {
            InitializeSubstitues();
            _wikipediaGateway = Substitute.For<IWikipediaGateway>();
            _adapter = new WikipediaPointsOfInterestAdapter(_elevationDataStorage, _elasticSearchGateway, _dataContainerConverterService, _wikipediaGateway, _itmWgs84MathTransfromFactory, _options, Substitute.For<ILogger>());
        }

        [TestMethod]
        public void GetPointOfInterestById_WrongLanguage_ShouldReturnNull()
        {
            var poiId = "42";
            var language = "en";
            var feature = GetValidFeature(poiId, _adapter.Source);
            feature.Attributes.Add(FeatureAttributes.POI_LANGUAGE, "he");
            var featureCollection = new FeatureCollection { feature };
            _dataContainerConverterService.ToDataContainer(Arg.Any<byte[]>(), Arg.Any<string>()).Returns(new DataContainer { Routes = new List<RouteData>() });

            _wikipediaGateway.GetById(poiId).Returns(featureCollection);

            var results = _adapter.GetPointOfInterestById(poiId, language).Result;

            Assert.IsNull(results);
        }

        [TestMethod]
        public void GetPointOfInterestById_ShouldGetIt()
        {
            var poiId = "42";
            var language = "en";
            var feature = GetValidFeature(poiId, _adapter.Source);
            feature.Attributes.Add(FeatureAttributes.POI_LANGUAGE, language);
            var featureCollection = new FeatureCollection { feature };
            _dataContainerConverterService.ToDataContainer(Arg.Any<byte[]>(), Arg.Any<string>()).Returns(new DataContainer { Routes = new List<RouteData>() });

            _wikipediaGateway.GetById(poiId).Returns(featureCollection);

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
            _wikipediaGateway.GetByLocation(Arg.Any<Coordinate>(), Arg.Any<string>()).Returns(new List<Feature> {GetValidFeature("1", Sources.WIKIPEDIA)});
            var points = _adapter.GetPointsForIndexing().Result;

            _wikipediaGateway.Received(1120).GetByLocation(Arg.Any<Coordinate>(), Arg.Any<string>());
            Assert.AreEqual(1, points.Count); // only 1 distinct
        }

    }
}
