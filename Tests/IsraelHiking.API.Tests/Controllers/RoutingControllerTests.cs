using IsraelHiking.API.Controllers;
using IsraelHiking.API.Executors;
using IsraelHiking.Common.Api;
using IsraelHiking.Common.DataContainer;
using IsraelHiking.DataAccessInterfaces;
using Microsoft.AspNetCore.Mvc;
using Microsoft.VisualStudio.TestTools.UnitTesting;
using NetTopologySuite.Features;
using NetTopologySuite.Geometries;
using NSubstitute;
using System.Linq;

namespace IsraelHiking.API.Tests.Controllers;

[TestClass]
public class RoutingControllerTests
{
    private RoutingController _controller;
    private IGraphHopperGateway _graphHopperGateway;
    private IElevationGateway _elevationGateway;

    [TestInitialize]
    public void TestInitialize()
    {
        _graphHopperGateway = Substitute.For<IGraphHopperGateway>();
        _elevationGateway = Substitute.For<IElevationGateway>();
        _elevationGateway.GetElevation(Arg.Any<Coordinate[]>()).Returns(info => Enumerable.Repeat(1.0, info.Arg<Coordinate[]>().Length).ToArray());
        _controller = new RoutingController(_graphHopperGateway, new ElevationSetterExecutor(_elevationGateway), new ItmWgs84MathTransformFactory(), new GeometryFactory());
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
    public void GetRouting_None_ShouldReturnLineStringWithTwoPoints()
    {
        var results = _controller.GetRouting("0.00001,0.00001", "0.00002,0.00002", RoutingType.NONE).Result as OkObjectResult;
        
        Assert.IsNotNull(results);
        var content = results.Value as FeatureCollection;
        Assert.IsNotNull(content);
        Assert.AreEqual(1, content.Count);
        var lineString = content.First().Geometry as LineString;
        Assert.IsNotNull(lineString);
        var points = lineString.Coordinates;
        Assert.AreEqual(0.00001, points.First().X);
        Assert.AreEqual(0.00001, points.First().Y);
        Assert.AreEqual(0.00002, points.Last().X);
        Assert.AreEqual(0.00002, points.Last().Y);
        Assert.AreEqual(2, points.Length);
    }

    [TestMethod]
    public void GetRouting_None_ShouldReturnLineStringWithManyPoints()
    {
        var results = _controller.GetRouting("1,1", "2,2", RoutingType.NONE).Result as OkObjectResult;
        
        Assert.IsNotNull(results);
        var content = results.Value as FeatureCollection;
        Assert.IsNotNull(content);
        Assert.AreEqual(1, content.Count);
        var lineString = content.First().Geometry as LineString;
        Assert.IsNotNull(lineString);
        var points = lineString.Coordinates;
        Assert.AreEqual(1, points.First().X);
        Assert.AreEqual(1, points.First().Y);
        Assert.AreEqual(2, points.Last().X);
        Assert.AreEqual(2, points.Last().Y);
        Assert.AreEqual(31, points.Length);
    }

    [TestMethod]
    public void GetRouting_Car_ShouldReturnLineStringFromGateway()
    {
        _graphHopperGateway.GetRouting(Arg.Any<RoutingGatewayRequest>())
            .Returns(new Feature(new LineString([
                new CoordinateZ(1,1, double.NaN),
                new CoordinateZ(1.5,1.5, double.NaN),
                new CoordinateZ(2,2, double.NaN)
            ]), new AttributesTable()));

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
}