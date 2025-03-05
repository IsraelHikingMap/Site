using IsraelHiking.API.Controllers;
using IsraelHiking.API.Executors;
using Microsoft.VisualStudio.TestTools.UnitTesting;
using NetTopologySuite.Geometries;

namespace IsraelHiking.API.Tests.Controllers;

[TestClass]
public class ItmGridControllerTests
{
    private ItmGridController _itmGridController;

    [TestMethod]
    public void GetItmCoordinates_ShouldConvertToNorthEast()
    {
        var northEast = new Coordinate { Y = 656336, X = 200138 };
        _itmGridController = new ItmGridController(new ItmWgs84MathTransformFactory());

        var response = _itmGridController.GetItmCoordinates(32, 35);

        Assert.AreEqual(northEast.X, response.East);
        Assert.AreEqual(northEast.Y, response.North);
    }
}