using System;
using System.Collections.Generic;
using System.Linq;
using IsraelHiking.API.Services.Poi;
using IsraelHiking.Common.Configuration;
using Microsoft.Extensions.Options;
using Microsoft.VisualStudio.TestTools.UnitTesting;
using NSubstitute;

namespace IsraelHiking.API.Tests.Services.Poi;

[TestClass]
public class PointsOfInterestAdapterFactoryTests
{
    private PointsOfInterestAdapterFactory _factory;
    private IEnumerable<IPointsOfInterestAdapter> _pointsOfInterestAdapters;

    [TestInitialize]
    public void TestInitialize()
    {
        var pointsOfInterestAdapter = Substitute.For<IPointsOfInterestAdapter>();
        pointsOfInterestAdapter.Source.Returns("source");
        _pointsOfInterestAdapters = [pointsOfInterestAdapter];
        var serviceProvider = Substitute.For<IServiceProvider>();
        serviceProvider.GetService(Arg.Any<Type>()).Returns(new CsvPointsOfInterestAdapter(null, null, null));
        var options = Substitute.For<IOptions<ConfigurationData>>();
        options.Value.Returns(new ConfigurationData
        {
            CsvsDictionary = new Dictionary<string, string>
            {
                {"csv", "some-url"}
            }
        });
        _factory = new PointsOfInterestAdapterFactory(_pointsOfInterestAdapters, serviceProvider, options);
    }

    [TestMethod]
    public void GetBySource_ShouldGetIt()
    {
        Assert.IsNotNull(_factory.GetBySource("source"));
    }
        
    [TestMethod]
    public void GetBySource_CSV_ShouldGetIt()
    {
        Assert.IsNotNull(_factory.GetBySource("csv"));
    }
        
    [TestMethod]
    public void GetAll_ShouldGetIt()
    {
        Assert.AreEqual(2, _factory.GetAll().Count());
    }
}