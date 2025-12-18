using IsraelHiking.Common;
using IsraelHiking.Common.Api;
using IsraelHiking.Common.Configuration;
using Microsoft.Extensions.Options;
using Microsoft.VisualStudio.TestTools.UnitTesting;
using NetTopologySuite.Features;
using NetTopologySuite.Geometries;
using NSubstitute;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using IsraelHiking.DataAccess.ElasticSearch;

namespace IsraelHiking.DataAccess.Tests.ElasticSearch;

[TestClass]
public class ElasticSearchGatewayTests
{
    private ElasticSearchGateway _gateway;

    [TestInitialize]
    public void TestInitialize()
    {
        var options = Substitute.For<IOptions<ConfigurationData>>();
        options.Value.Returns(new ConfigurationData());
        _gateway = new ElasticSearchGateway(options, new TraceLogger()); 
        _gateway.Initialize().Wait();
    }

    [TestMethod]
    [Ignore]
    public void Search_ShouldReturnResults()
    {
        var results = _gateway.Search("מנות", Languages.HEBREW).Result;
        Assert.AreEqual(20, results.Count);
    }
    
    [TestMethod]
    [Ignore]
    public void SearchRussian_ShouldReturnResults()
    {
        // Caesarea
        var results = _gateway.Search("Кейсария", Languages.HEBREW).Result;
        Assert.AreEqual(20, results.Count);
    }
        
    [TestMethod]
    [Ignore]
    public void GetContainerName_ShouldReturnResults()
    {
        var results = _gateway.GetContainerName([new Coordinate(35.05746, 32.596838)], Languages.RUSSIAN).Result;
        Assert.AreEqual("Ramot Menashe", results);
    }

    [TestMethod]
    [Ignore]
    public void SearchWithinPlace_ShouldReturnResults()
    {
        var results = _gateway.SearchPlaces("פינת הזיכרון, רמות מנשה", Languages.HEBREW).Result;
        Assert.AreEqual(1, results.Count);
    }

    [TestMethod]
    [Ignore]
    public void GetClosestPoint_ShouldReturnResults()
    {
        var coordinate = new Coordinate(35.303488, 33.027086);
        var results = _gateway.GetClosestPoint(coordinate, Sources.OSM, null).Result;
        Assert.IsNotNull(results);
    }
    
    [TestMethod]
    [Ignore]
    public void GetClosestPointWithmultiplePointsInBoundingBox_ShouldReturnResults()
    {
        var coordinate = new Coordinate(34.78588, 31.245418);
        var results = _gateway.GetClosestPoint(coordinate, Sources.OSM, null).Result;
        Assert.IsNotNull(results);
    }
        
    [TestMethod]
    [Ignore]
    public void GetClosestPoint_NoSourceIsSpecified_ShouldReturnResults()
    {
        var coordinate = new Coordinate(35.23087, 32.93687);
        var results = _gateway.GetClosestPoint(coordinate, null, Languages.HEBREW).Result;
        Assert.IsNotNull(results);
    }
        
    [TestMethod]
    [Ignore]
    public void GetClosestPoint_OSMSourceSpecified_ShouldNotReturnResults()
    {
        var coordinate = new Coordinate(35.23087, 32.93687);
        var results = _gateway.GetClosestPoint(coordinate, Sources.OSM, Languages.HEBREW).Result;
        Assert.IsNull(results);
    }

    [TestMethod]
    [Ignore]
    public void GetContainerName_MultipleCoordinates_ShouldGetOne()
    {
        var name = _gateway.GetContainerName([new Coordinate(35.052338, 32.598071), new Coordinate(35.059919, 32.597458)], Languages.HEBREW).Result;

        Assert.AreEqual("רמות מנשה", name);
    }

    [TestMethod]
    [Ignore]
    public void GetPoisBySource_ShouldGetThem()
    {
        var tasks = new List<Task<List<IFeature>>>
        {
            _gateway.GetExternalPoisBySource(Sources.INATURE),
            _gateway.GetExternalPoisBySource(Sources.NAKEB),
            _gateway.GetExternalPoisBySource(Sources.WIKIPEDIA)
        };
        Task.WhenAll(tasks).Wait();

        Assert.IsTrue(tasks.Last().Result.Count > 10000);
    }

    [TestMethod]
    [Ignore]
    public void GetImageByUrl_ShouldGetIt()
    {
        var imageItem = _gateway.GetImageByUrl("https://upload.wikimedia.org/wikipedia/commons/0/05/Israel_Hiking_Map_%D7%97%D7%95%D7%A8%D7%91%D7%AA_%D7%97%D7%A0%D7%95%D7%AA_2.jpeg").Result;

        Assert.IsNotNull(imageItem);
    }

    [TestMethod]
    [Ignore]
    public void GetImageHash_ShouldGetIt()
    {
        var imageItem = _gateway.GetImageByHash("7F4E8F16362FD1E527FFBC516E0197C7").Result;

        Assert.IsNotNull(imageItem);
    }

    [TestMethod]
    [Ignore]
    public void GetAllUrls_ShouldGetThem()
    {
        var imageItem = _gateway.GetAllUrls().Result;

        Assert.IsNotNull(imageItem);
    }

    [TestMethod]
    [Ignore]
    public void GetAllPointsOfInterest_ShouldGetThem()
    {
        var results = _gateway.GetAllPointsOfInterest().Result;

        Assert.IsNotNull(results);
    }

    [TestMethod]
    [Ignore]
    public void StoreRebuildContext_ShouldStore()
    {
        _gateway.StoreRebuildContext(new RebuildContext
        {
            StartTime = DateTime.Now.AddDays(-5),
            Succeeded = true,
            ErrorMessage = string.Empty,
            Request = new UpdateRequest
            {
                AllExternalSources = true,
            }
        }).Wait();
    }
        
    [TestMethod]
    [Ignore]
    public void SearchExact_ShouldSGetAnExactMatch()
    {
        var results = _gateway.SearchExact("חיפה", Languages.HEBREW).Result;

        Assert.IsTrue(results.Count > 0);
    }
}