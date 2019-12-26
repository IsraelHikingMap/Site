using GeoAPI.Geometries;
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
            _adapter = new WikipediaPointsOfInterestAdapter(_dataContainerConverterService, _wikipediaGateway, Substitute.For<ILogger>());
        }

        [TestMethod]
        public void GetPointsForIndexing_ShouldGetAllPointsFromGateway()
        {
            _wikipediaGateway.GetByBoundingBox(Arg.Any<Coordinate>(), Arg.Any<Coordinate>(), Arg.Any<string>()).Returns(new List<Feature> {GetValidFeature("1", Sources.WIKIPEDIA)});
            var points = _adapter.GetPointsForIndexing().Result;

            _wikipediaGateway.Received(952).GetByBoundingBox(Arg.Any<Coordinate>(), Arg.Any<Coordinate>(), Arg.Any<string>());
            Assert.AreEqual(1, points.Count); // only 1 distinct
        }

    }
}
