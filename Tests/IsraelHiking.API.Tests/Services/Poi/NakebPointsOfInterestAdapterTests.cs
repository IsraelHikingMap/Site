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
    public class NakebPointsOfInterestAdapterTests : BasePointsOfInterestAdapterTestsHelper
    {
        private NakebPointsOfInterestAdapter _adapter;
        private INakebGateway _nakebGateway;

        [TestInitialize]
        public void TestInitialize()
        {
            InitializeSubstitues();
            _nakebGateway = Substitute.For<INakebGateway>();
            _adapter = new NakebPointsOfInterestAdapter(_nakebGateway, _dataContainerConverterService, Substitute.For<ILogger>());
        }

        [TestMethod]
        public void GetPointsForIndexing_ShouldGetAllPointsFromGateway()
        {
            var featuresList = new List<Feature> { new Feature(null, null)};
            _nakebGateway.GetAll().Returns(featuresList);

            var points = _adapter.GetPointsForIndexing().Result;

            Assert.AreEqual(featuresList.Count, points.Count);
        }
    }
}
