using IsraelHiking.API.Services.Poi;
using IsraelHiking.Common;
using IsraelHiking.DataAccessInterfaces;
using IsraelHiking.DataAccessInterfaces.Repositories;
using Microsoft.Extensions.Logging;
using Microsoft.VisualStudio.TestTools.UnitTesting;
using NetTopologySuite.Features;
using NSubstitute;
using System.Collections.Generic;

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
            _adapter = new INaturePointsOfInterestAdapter(_dataContainerConverterService, _iNatureGateway, _repository, Substitute.For<ILogger>());
        }

        [TestMethod]
        public void GetPointsForIndexing_ShouldGetFromGateway()
        {
            var features = new List<Feature>();
            _iNatureGateway.GetAll().Returns(features);

            var resutls = _adapter.GetAll().Result;

            Assert.AreEqual(features.Count, resutls.Count);
        }
    }
}
