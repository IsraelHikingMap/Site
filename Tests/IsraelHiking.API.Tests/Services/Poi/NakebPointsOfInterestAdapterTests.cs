using System;
using IsraelHiking.API.Services.Poi;
using IsraelHiking.Common;
using IsraelHiking.DataAccessInterfaces;
using Microsoft.Extensions.Logging;
using Microsoft.VisualStudio.TestTools.UnitTesting;
using NetTopologySuite.Features;
using NSubstitute;
using System.Collections.Generic;
using System.Linq;
using IsraelHiking.Common.Extensions;

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
            InitializeSubstitutes();
            _nakebGateway = Substitute.For<INakebGateway>();
            _adapter = new NakebPointsOfInterestAdapter(_nakebGateway, Substitute.For<ILogger>());
        }

        [TestMethod]
        public void GetSourceName_ShouldReturnNakeb()
        {
            Assert.AreEqual(Sources.NAKEB, _adapter.Source);
        }

        [TestMethod]
        public void GetAll_ShouldGetAllPointsFromGateway()
        {
            var featuresList = new List<Feature> { new Feature(null, new AttributesTable { { FeatureAttributes.ID, "42" } })};
            _nakebGateway.GetAll().Returns(featuresList);
            _nakebGateway.GetById(Arg.Any<string>()).Returns(featuresList.First());

            var points = _adapter.GetAll().Result;

            Assert.AreEqual(featuresList.Count, points.Count);
        }
        
        [TestMethod]
        public void GetUpdates_OneOldOneNew_ShouldGetOnlyNew()
        {
            var feature1 = new Feature(null, new AttributesTable {{FeatureAttributes.ID, "42"}});
            feature1.SetLastModified(DateTime.MinValue);
            var feature2 = new Feature(null, new AttributesTable {{FeatureAttributes.ID, "42"}});
            feature2.SetLastModified(DateTime.Now);
            var featuresList = new List<Feature> { feature1, feature2};
            _nakebGateway.GetAll().Returns(featuresList);
            _nakebGateway.GetById(Arg.Any<string>()).Returns(featuresList.Last());

            var points = _adapter.GetUpdates(DateTime.Now.AddDays(-10)).Result;

            Assert.AreEqual(1, points.Count);
        }
    }
}
