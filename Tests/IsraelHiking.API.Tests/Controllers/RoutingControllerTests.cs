using IsraelHiking.API.Controllers;
using IsraelHiking.Common;
using IsraelHiking.Common.Api;
using IsraelHiking.Common.DataContainer;
using IsraelHiking.DataAccessInterfaces;
using Microsoft.AspNetCore.Mvc;
using Microsoft.VisualStudio.TestTools.UnitTesting;
using NetTopologySuite.Features;
using NetTopologySuite.Geometries;
using NSubstitute;
using System.Collections.Generic;
using System.Linq;

namespace IsraelHiking.API.Tests.Controllers;

[TestClass]
public class RoutingControllerTests
{
    private RoutingController _controller;
    private IGraphHopperGateway _graphHopperGateway;

    [TestInitialize]
    public void TestInitialize()
    {
        _graphHopperGateway = Substitute.For<IGraphHopperGateway>();
        _controller = new RoutingController(_graphHopperGateway);
    }

    private static Feature CreateLineStringFeature()
    {
        return new Feature(new LineString([
            new CoordinateZ(1, 1, double.NaN),
            new CoordinateZ(1.5, 1.5, double.NaN),
            new CoordinateZ(2, 2, double.NaN)
        ]), new AttributesTable());
    }

    [TestMethod]
    public void GetRouting_HikingBadFromPoint_ShouldReturnInvalidModelState()
    {
        var results = _controller.GetRouting("from", "1,1", RoutingType.HIKE).Result as BadRequestObjectResult;

        Assert.IsNotNull(results);
    }

    [TestMethod]
    public void GetRouting_BikeBadToPoint_ShouldReturnInvalidModelState()
    {
        var results = _controller.GetRouting("1,1", "to", RoutingType.BIKE).Result as BadRequestObjectResult;

        Assert.IsNotNull(results);
    }

    [TestMethod]
    public void GetRouting_BadFromPointWithThreeParts_ShouldReturnInvalidModelState()
    {
        var results = _controller.GetRouting("1,1,1", "2,2", RoutingType.HIKE).Result as BadRequestObjectResult;

        Assert.IsNotNull(results);
        _graphHopperGateway.DidNotReceive().GetRouting(Arg.Any<RoutingGatewayRequest>());
    }

    [TestMethod]
    public void GetRouting_Car_ShouldReturnLineStringFromGateway()
    {
        _graphHopperGateway.GetRouting(Arg.Any<RoutingGatewayRequest>())
            .Returns(CreateLineStringFeature());

        var results = _controller.GetRouting("1,1", "2,2", RoutingType.FOUR_WHEEL_DRIVE).Result as OkObjectResult;

        Assert.IsNotNull(results);
        var content = results.Value as FeatureCollection;
        Assert.IsNotNull(content);
        Assert.AreEqual(1, content.Count);
        var lineString = content.First().Geometry as LineString;
        Assert.IsNotNull(lineString);
        var points = lineString.Coordinates;
        Assert.AreEqual(3, points.Length);
        Assert.AreEqual(1, points.First().X);
        Assert.AreEqual(1, points.First().Y);
        Assert.AreEqual(2, points.Last().X);
        Assert.AreEqual(2, points.Last().Y);
    }

    [TestMethod]
    public void GetRouting_ShouldParseCoordinatesAsLatLngAndPassThemToTheGateway()
    {
        _graphHopperGateway.GetRouting(Arg.Any<RoutingGatewayRequest>())
            .Returns(CreateLineStringFeature());

        // Position string is "lat,lng"; the coordinate that reaches the gateway is (X = lng, Y = lat).
        _controller.GetRouting("31.8,35.0", "32.1,35.5", RoutingType.HIKE).Wait();

        _graphHopperGateway.Received(1).GetRouting(Arg.Is<RoutingGatewayRequest>(r =>
            r.From.X == 35.0 && r.From.Y == 31.8 &&
            r.To.X == 35.5 && r.To.Y == 32.1));
    }

    [DataTestMethod]
    [DataRow(RoutingType.HIKE, ProfileType.Foot)]
    [DataRow(RoutingType.BIKE, ProfileType.Bike)]
    [DataRow(RoutingType.FOUR_WHEEL_DRIVE, ProfileType.Car4WheelDrive)]
    [DataRow(RoutingType.NONE, ProfileType.None)]
    [DataRow("Unknown", ProfileType.Foot)]
    public void GetRouting_ShouldConvertRoutingTypeToProfile(string routingType, ProfileType expectedProfile)
    {
        _graphHopperGateway.GetRouting(Arg.Any<RoutingGatewayRequest>())
            .Returns(CreateLineStringFeature());

        _controller.GetRouting("1,1", "2,2", routingType).Wait();

        _graphHopperGateway.Received(1).GetRouting(Arg.Is<RoutingGatewayRequest>(r => r.Profile == expectedProfile));
    }

    [TestMethod]
    public void PostMapMatch_NullPoints_ShouldReturnInvalidModelState()
    {
        var results = _controller.PostMapMatch(null, RoutingType.HIKE, "en").Result as BadRequestObjectResult;

        Assert.IsNotNull(results);
        _graphHopperGateway.DidNotReceive().GetMapMatch(Arg.Any<MapMatchGatewayRequest>());
    }

    [TestMethod]
    public void PostMapMatch_SinglePoint_ShouldReturnInvalidModelState()
    {
        var points = new List<LatLng> { new(1, 1) };

        var results = _controller.PostMapMatch(points, RoutingType.HIKE, "en").Result as BadRequestObjectResult;

        Assert.IsNotNull(results);
        _graphHopperGateway.DidNotReceive().GetMapMatch(Arg.Any<MapMatchGatewayRequest>());
    }

    [TestMethod]
    public void PostMapMatch_TwoPoints_ShouldReturnLineStringFromGateway()
    {
        _graphHopperGateway.GetMapMatch(Arg.Any<MapMatchGatewayRequest>())
            .Returns(CreateLineStringFeature());
        var points = new List<LatLng> { new(31.8, 35.0), new(32.1, 35.5) };

        var results = _controller.PostMapMatch(points, RoutingType.BIKE, "he").Result as OkObjectResult;

        Assert.IsNotNull(results);
        var content = results.Value as FeatureCollection;
        Assert.IsNotNull(content);
        Assert.AreEqual(1, content.Count);
        Assert.IsNotNull(content.First().Geometry as LineString);
    }

    [TestMethod]
    public void PostMapMatch_ShouldPassConvertedPointsProfileAndLanguageToTheGateway()
    {
        _graphHopperGateway.GetMapMatch(Arg.Any<MapMatchGatewayRequest>())
            .Returns(CreateLineStringFeature());
        var points = new List<LatLng> { new(31.8, 35.0), new(32.1, 35.5) };

        _controller.PostMapMatch(points, RoutingType.BIKE, "he").Wait();

        // LatLng (lat, lng) becomes a coordinate of (X = lng, Y = lat).
        _graphHopperGateway.Received(1).GetMapMatch(Arg.Is<MapMatchGatewayRequest>(r =>
            r.Profile == ProfileType.Bike &&
            r.Language == "he" &&
            r.Points.Count == 2 &&
            r.Points[0].X == 35.0 && r.Points[0].Y == 31.8 &&
            r.Points[1].X == 35.5 && r.Points[1].Y == 32.1));
    }
}
