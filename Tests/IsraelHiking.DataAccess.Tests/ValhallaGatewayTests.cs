using System.Collections;
using System.Collections.Generic;
using System.Linq;
using System.Net.Http;
using IsraelHiking.Common.Api;
using IsraelHiking.Common.Configuration;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using Microsoft.VisualStudio.TestTools.UnitTesting;
using NetTopologySuite.Geometries;
using NSubstitute;

namespace IsraelHiking.DataAccess.Tests;

[TestClass]
public class ValhallaGatewayTests
{
    private ValhallaGateway gateway;

    private static List<Coordinate> GetTraceAlongARealRoute(ValhallaGateway gateway)
    {
        var route = gateway.GetRouting(new RoutingGatewayRequest
        {
            From = new Coordinate(35.2447, 31.9714),
            To = new Coordinate(35.2300, 31.9650),
            Profile = ProfileType.Car4WheelDrive
        }).Result;
        return [.. route.Geometry.Coordinates.Select(c => new Coordinate(c.X, c.Y))];
    }

    [TestInitialize]
    public void TestInitialize()
    {
        var factory = Substitute.For<IHttpClientFactory>();
        factory.CreateClient().Returns(new HttpClient());
        var options = Substitute.For<IOptions<ConfigurationData>>();
        options.Value.Returns(new ConfigurationData
        {
            ValhallaServerAddress = "https://mapeak.com/valhalla/"
        });
        gateway = new ValhallaGateway(factory, options, Substitute.For<ILogger>());
    }

    [TestMethod]
    [Ignore]
    public void GetRouting_ShouldGetRoutingWithDetails()
    {
        var results = gateway.GetRouting(new RoutingGatewayRequest
        {
            From = new Coordinate(35.24470233230383, 31.971396577420734),
            To = new Coordinate(35.00963707334776, 31.926065209376176),
            Profile = ProfileType.Foot
        }).Result;
        Assert.IsNotNull(results);
        Assert.IsTrue(results.Geometry.Coordinates.Length > 100);
        Assert.IsTrue(results.Geometry.Coordinates[0].Z > 0);
    }

    [TestMethod]
    [Ignore]
    public void GetMapMatch_Legacy_ShouldGetGraphHopperCompatibleInstructions()
    {
        var results = gateway.GetMapMatch(new MapMatchGatewayRequest
        {
            Points = GetTraceAlongARealRoute(gateway),
            Language = "he",
            Profile = ProfileType.Car4WheelDrive,
            Format = InstructionsFormat.Legacy
        }).Result;
        Assert.IsNotNull(results);
        Assert.IsTrue(results.Geometry.Coordinates.Length > 2);
        var instructions = results.Attributes["instructions"] as IList;
        Assert.IsNotNull(instructions);
        Assert.IsTrue(instructions.Count > 0);
    }

    [TestMethod]
    [Ignore]
    public void GetMapMatch_V2_ShouldGetNormalizedInstructions()
    {
        var results = gateway.GetMapMatch(new MapMatchGatewayRequest
        {
            Points = GetTraceAlongARealRoute(gateway),
            Language = "he",
            Profile = ProfileType.Car4WheelDrive,
            Format = InstructionsFormat.V2
        }).Result;
        Assert.IsNotNull(results);
        var instructions = results.Attributes["instructions"] as List<RouteInstruction>;
        Assert.IsNotNull(instructions);
        Assert.IsTrue(instructions.Count > 0);
        Assert.IsTrue(instructions.All(i => !string.IsNullOrEmpty(i.VerbalText)));
    }
}