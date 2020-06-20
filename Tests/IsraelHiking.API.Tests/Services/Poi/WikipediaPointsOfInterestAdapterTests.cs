using IsraelHiking.API.Services.Poi;
using IsraelHiking.Common;
using IsraelHiking.Common.Extensions;
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
            _adapter = new WikipediaPointsOfInterestAdapter(_wikipediaGateway, Substitute.For<ILogger>());
        }

        [TestMethod]
        public void GetAll_ShouldGetAllPointsFromGateway()
        {
            var feature = GetValidFeature("1", Sources.WIKIPEDIA);
            feature.SetId();
            var list = new List<Feature> { feature };
            _wikipediaGateway.GetByBoundingBox(Arg.Any<Coordinate>(), Arg.Any<Coordinate>(), Arg.Any<string>()).Returns(list);
            _wikipediaGateway.GetByPagesTitles(Arg.Any<string[]>(), Arg.Any<string>()).Returns(list);

            var points = _adapter.GetAll().Result;
            
            _wikipediaGateway.Received(952).GetByBoundingBox(Arg.Any<Coordinate>(), Arg.Any<Coordinate>(), Arg.Any<string>());
            Assert.AreEqual(Languages.Array.Length, points.Count); // distinct by number of lanugages
        }

    }
}
