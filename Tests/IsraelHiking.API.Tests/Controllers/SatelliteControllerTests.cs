using System.IO;
using IsraelHiking.API.Controllers;
using IsraelHiking.DataAccessInterfaces;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Caching.Memory;
using Microsoft.Extensions.Logging;
using Microsoft.VisualStudio.TestTools.UnitTesting;
using NSubstitute;

namespace IsraelHiking.API.Tests.Controllers;

[TestClass]
public class SatelliteControllerTests
{
    private SatelliteController _controller;
    private ISatelliteImageryGateway _satelliteImageryGateway;
    private IReceiptValidationGateway _receiptValidationGateway;

    [TestInitialize]
    public void TestInitialize()
    {
        _satelliteImageryGateway = Substitute.For<ISatelliteImageryGateway>();
        _receiptValidationGateway = Substitute.For<IReceiptValidationGateway>();
        _controller = new SatelliteController(_satelliteImageryGateway,
            _receiptValidationGateway,
            new MemoryCache(new MemoryCacheOptions()),
            Substitute.For<ILogger>());
    }

    [TestMethod]
    public void GetTile_NotEntitled_ShouldGetForbid()
    {
        _controller.SetupIdentity();
        _receiptValidationGateway.IsEntitled(Arg.Any<string>()).Returns(false);

        var results = _controller.GetTile(10, 20, 30).Result as ForbidResult;

        Assert.IsNotNull(results);
        _satelliteImageryGateway.DidNotReceiveWithAnyArgs().GetTile(0, 0, 0);
    }

    [TestMethod]
    public void GetTile_NoImageryForTile_ShouldGetNotFound()
    {
        _controller.SetupIdentity();
        _receiptValidationGateway.IsEntitled(Arg.Any<string>()).Returns(true);
        _satelliteImageryGateway.GetTile(10, 20, 30).Returns((Stream)null);

        var results = _controller.GetTile(10, 20, 30).Result as NotFoundResult;

        Assert.IsNotNull(results);
    }

    [TestMethod]
    public void GetTile_Entitled_ShouldGetTheTile()
    {
        _controller.SetupIdentity();
        _receiptValidationGateway.IsEntitled(Arg.Any<string>()).Returns(true);
        _satelliteImageryGateway.GetTile(10, 20, 30).Returns(new MemoryStream([1, 2, 3]));

        var results = _controller.GetTile(10, 20, 30).Result as FileStreamResult;

        Assert.IsNotNull(results);
        Assert.AreEqual("image/jpeg", results.ContentType);
    }

    [TestMethod]
    public void GetTile_TwoTilesForTheSameUser_ShouldOnlyValidateTheReceiptOnce()
    {
        _controller.SetupIdentity();
        _receiptValidationGateway.IsEntitled(Arg.Any<string>()).Returns(true);
        _satelliteImageryGateway.GetTile(Arg.Any<int>(), Arg.Any<int>(), Arg.Any<int>()).Returns(new MemoryStream([1, 2, 3]));

        _ = _controller.GetTile(10, 20, 30).Result;
        _ = _controller.GetTile(10, 20, 31).Result;

        _receiptValidationGateway.Received(1).IsEntitled(Arg.Any<string>());
    }
}
