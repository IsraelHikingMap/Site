using System;
using IsraelHiking.API.Services.Poi;
using IsraelHiking.DataAccessInterfaces;
using Microsoft.Extensions.Logging;
using Microsoft.VisualStudio.TestTools.UnitTesting;
using NetTopologySuite.Features;
using NSubstitute;
using System.Collections.Generic;
using IsraelHiking.API.Gpx;
using IsraelHiking.Common;
using IsraelHiking.Common.DataContainer;
using NetTopologySuite.Geometries;

namespace IsraelHiking.API.Tests.Services.Poi;

[TestClass]
public class INaturePointsOfInterestAdapterTests : BasePointsOfInterestAdapterTestsHelper
{
    private INaturePointsOfInterestAdapter _adapter;
    private IINatureGateway _iNatureGateway;
    private IShareUrlGateway _shareUrlGateway;

    [TestInitialize]
    public void TestInitialize()
    {
        InitializeSubstitutes();
        _iNatureGateway = Substitute.For<IINatureGateway>();
        _shareUrlGateway = Substitute.For<IShareUrlGateway>();
        _adapter = new INaturePointsOfInterestAdapter(_dataContainerConverterService, _iNatureGateway, _shareUrlGateway, Substitute.For<ILogger>());
    }

    [TestMethod]
    public void GetSourceName_ShouldReturnINature()
    {
        Assert.AreEqual(Sources.INATURE, _adapter.Source);
    }
        
    [TestMethod]
    public void GetPointsForIndexing_ShouldGetFromGateway()
    {
        var features = new List<IFeature>
        {
            new Feature(new Point(0,0), new AttributesTable()),
            new Feature(new LineString([new Coordinate(0,0), new Coordinate(1,1)]),
                new AttributesTable
                {
                    {FeatureAttributes.POI_SHARE_REFERENCE, "missing-url"}
                }),
            new Feature(new LineString([new Coordinate(0,0), new Coordinate(1,1)]),
                new AttributesTable
                {
                    {FeatureAttributes.POI_SHARE_REFERENCE, "share-url"}
                })
        };
        _iNatureGateway.GetAll().Returns(features);
        _shareUrlGateway.GetUrlById("share-url").Returns(new ShareUrl());
        _dataContainerConverterService.ToAnyFormat(Arg.Any<DataContainerPoco>(), Arg.Any<string>())
            .Returns(new FeatureCollection().ToBytes());
            
        var results = _adapter.GetAll().Result;

        Assert.AreEqual(features.Count, results.Count);
    }

    [TestMethod]
    public void GetUpdates_ShouldGetThem()
    {
        var list = new List<IFeature>();
        _iNatureGateway.GetUpdates(Arg.Any<DateTime>()).Returns(list);

        var results = _adapter.GetUpdates(DateTime.Now).Result;
            
        Assert.AreEqual(list.Count, results.Count);
    }
}