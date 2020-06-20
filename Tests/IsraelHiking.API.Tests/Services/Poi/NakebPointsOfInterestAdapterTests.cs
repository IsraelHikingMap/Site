using IsraelHiking.API.Services.Poi;
using IsraelHiking.Common;
using IsraelHiking.DataAccessInterfaces;
using Microsoft.Extensions.Logging;
using Microsoft.VisualStudio.TestTools.UnitTesting;
using NetTopologySuite.Features;
using NSubstitute;
using System.Collections.Generic;
using System.Linq;

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
            _adapter = new NakebPointsOfInterestAdapter(_nakebGateway, Substitute.For<ILogger>());
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
    }
}
