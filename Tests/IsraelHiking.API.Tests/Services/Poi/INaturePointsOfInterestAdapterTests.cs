using System;
using System.Collections.Generic;
using System.Collections.ObjectModel;
using System.Text;
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
    public class INaturePointsOfInterestAdapterTests : BasePointsOfInterestAdapterTestsHelper
    {
        private INaturePointsOfInterestAdapter _adapter;
        private IINatureGateway _iNatureGateway;
        private IRepository _repository;

        [TestInitialize]
        public void TestInitialize()
        {
            InitializeSubstitues();
            _iNatureGateway = Substitute.For<IINatureGateway>();
            _repository = Substitute.For<IRepository>();
            _adapter = new INaturePointsOfInterestAdapter(_elevationDataStorage, _elasticSearchGateway, _dataContainerConverterService, _iNatureGateway, _repository, _itmWgs84MathTransfromFactory, _options, Substitute.For<ILogger>());
        }

        [TestMethod]
        public void GetPointsForIndexing_ShouldGetFromGateway()
        {
            var features = new List<Feature>();
            _iNatureGateway.GetAll().Returns(features);

            var resutls = _adapter.GetPointsForIndexing().Result;

            Assert.AreEqual(features.Count, resutls.Count);
        }

        [TestMethod]
        public void GetPointOfInterestById_NotInCache_ShouldGetFromGatewayAndAddShareData()
        {
            var poiId = "poiId";
            var shareId = "shareId";
            var feature = GetValidFeature(poiId, _adapter.Source);
            feature.Attributes.AddAttribute(FeatureAttributes.POI_SHARE_REFERENCE, shareId);
            _repository.GetUrlById(shareId).Returns(new ShareUrl {DataContainer = new DataContainer()});
            _iNatureGateway.GetById(poiId).Returns(new FeatureCollection(new Collection<IFeature> {feature}));
            _dataContainerConverterService.ToDataContainer(Arg.Any<byte[]>(), Arg.Any<string>()).Returns(new DataContainer { Routes = new List<RouteData>() });

            var resutls = _adapter.GetPointOfInterestById(poiId, Languages.HEBREW).Result;

            Assert.IsNotNull(resutls);
            _repository.Received(1).GetUrlById(shareId);
        }
    }
}
