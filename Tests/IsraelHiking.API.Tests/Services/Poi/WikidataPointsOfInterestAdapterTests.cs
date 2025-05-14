using System;
using System.Collections.Generic;
using IsraelHiking.API.Services.Poi;
using IsraelHiking.Common;
using IsraelHiking.Common.Extensions;
using IsraelHiking.DataAccessInterfaces;
using Microsoft.Extensions.Logging;
using Microsoft.VisualStudio.TestTools.UnitTesting;
using NetTopologySuite.Features;
using NetTopologySuite.Geometries;
using NSubstitute;

namespace IsraelHiking.API.Tests.Services.Poi;

[TestClass]
public class WikidataPointsOfInterestAdapterTests : BasePointsOfInterestAdapterTestsHelper
{
    private WikidataPointsOfInterestAdapter _adapter;
    private IWikidataGateway _wikidataGateway;
    
    [TestInitialize]
    public void TestInitialize()
    {
        InitializeSubstitutes();
        _wikidataGateway = Substitute.For<IWikidataGateway>();
        _adapter = new WikidataPointsOfInterestAdapter(_wikidataGateway, Substitute.For<ILogger>());
    }
    
    [TestMethod]
    public void GetAll_ShouldGetAllPointsFromGateway()
    {
        var feature = GetValidFeature("1", Sources.WIKIDATA);
        feature.SetId();
        var list = new List<IFeature> { feature };
        _wikidataGateway.GetByBoundingBox(Arg.Any<Coordinate>(), Arg.Any<Coordinate>()).Returns(list);

        var points = _adapter.GetAll().Result;
            
        _wikidataGateway.Received().GetByBoundingBox(Arg.Any<Coordinate>(), Arg.Any<Coordinate>());
        Assert.IsTrue(points.Count >= 40);
    }
    
    [TestMethod]
    public void GetUpdates_ShouldGetAllPointsFromGateway()
    {
        var feature = GetValidFeature("1", Sources.WIKIDATA);
        feature.SetId();
        feature.SetLastModified(DateTime.Now.AddDays(-1));
        var list = new List<IFeature> { feature };
        _wikidataGateway.GetByBoundingBox(Arg.Any<Coordinate>(), Arg.Any<Coordinate>()).Returns(list);

        var points = _adapter.GetUpdates(DateTime.Now).Result;
            
        _wikidataGateway.Received().GetByBoundingBox(Arg.Any<Coordinate>(), Arg.Any<Coordinate>());
        Assert.AreEqual(0, points.Count);
    }
}
