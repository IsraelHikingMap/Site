using IsraelHiking.Common;
using IsraelHiking.Common.Configuration;
using Microsoft.Extensions.Options;
using Microsoft.VisualStudio.TestTools.UnitTesting;
using NetTopologySuite.Geometries;
using NSubstitute;
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
    public void GetContainerName_MultipleCoordinates_ShouldGetOne()
    {
        var name = _gateway.GetContainerName([new Coordinate(35.052338, 32.598071), new Coordinate(35.059919, 32.597458)], Languages.HEBREW).Result;

        Assert.AreEqual("רמות מנשה", name);
    }

    [TestMethod]
    [Ignore]
    public void GetContainerName_TrackWhoseEnvelopeSticksOutOfTheArea_ShouldGetTheArea()
    {
        // Every point is inside Ramot Menashe but their envelope is not, which used to return Megiddo Regional Council
        var name = _gateway.GetContainerName([
            new Coordinate(35.059925, 32.596253),
            new Coordinate(35.05829, 32.597951),
            new Coordinate(35.056224, 32.598374),
            new Coordinate(35.055908, 32.596352)
        ], Languages.HEBREW).Result;

        Assert.AreEqual("רמות מנשה", name);
    }

    [TestMethod]
    [Ignore]
    public void SearchExact_ShouldSGetAnExactMatch()
    {
        var results = _gateway.SearchExact("חיפה", Languages.HEBREW).Result;

        Assert.IsTrue(results.Count > 0);
    }
}