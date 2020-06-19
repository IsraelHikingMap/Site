using IsraelHiking.API.Controllers;
using IsraelHiking.API.Services.Osm;
using IsraelHiking.Common.Api;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Logging;
using Microsoft.VisualStudio.TestTools.UnitTesting;
using NSubstitute;
using System.Net;
using System.Threading.Tasks;

namespace IsraelHiking.API.Tests.Controllers
{
    [TestClass]
    public class UpdateControllerTests
    {
        private UpdateController _controller;
        private IDatabasesUpdaterService _databasesUpdaterService;

        [TestInitialize]
        public void TestInitialize()
        {
            var logger = Substitute.For<ILogger>();
            _databasesUpdaterService = Substitute.For<IDatabasesUpdaterService>();
            _controller = new UpdateController(_databasesUpdaterService, logger);
        }

        private void SetupContext(IPAddress localIp, IPAddress remoteIp)
        {
            _controller.ControllerContext = new ControllerContext
            {
                HttpContext = new DefaultHttpContext
                {
                    Connection =
                    {
                        LocalIpAddress = localIp,
                        RemoteIpAddress = remoteIp
                    }
                }
            };
        }
        
        [TestMethod]
        public void PostUpdateData_LocalAndRemoteDoNotMatch_ShouldReturnBadRequest()
        {
            SetupContext(IPAddress.Parse("1.2.3.4"), IPAddress.Parse("5.6.7.8"));
            
            var results = _controller.PostUpdateData(null).Result;
            
            Assert.IsNotNull(results as BadRequestObjectResult);
        }

        [TestMethod]
        public void PostUpdateData_RequestIsNull_ShouldUpdateAllGateways()
        {
            SetupContext(IPAddress.Parse("1.2.3.4"), IPAddress.Loopback);

            _controller.PostUpdateData(null).Wait();

            _databasesUpdaterService.Received(1).Rebuild(Arg.Any<UpdateRequest>());
            
        }

        [TestMethod]
        public void PostUpdateData_RemoteIs10101010Defaultrequest_ShouldUpdateAllGateways()
        {
            SetupContext(IPAddress.Parse("1.2.3.4"), IPAddress.Parse("10.10.10.10"));
            
            _controller.PostUpdateData(new UpdateRequest()).Wait();

            _databasesUpdaterService.Received(1).Rebuild(Arg.Any<UpdateRequest>());
        }

        [TestMethod]
        public void PutUpdateData_NonLocal_ShouldReturnBadReqeust()
        {
            SetupContext(IPAddress.Parse("1.2.3.4"), IPAddress.Parse("5.6.7.8"));

            var results = _controller.PutUpdateData().Result as BadRequestObjectResult;

            Assert.IsNotNull(results);
        }

        [TestMethod]
        public void PutUpdateData_Local_ShouldUpdate()
        {
            SetupContext(IPAddress.Parse("1.2.3.4"), IPAddress.Loopback);

            _controller.PutUpdateData().Wait();

            _databasesUpdaterService.Received(1).Update();
        }

        [TestMethod]
        public void PutUpdateData_FromTwoThreads_ShouldUpdateTwice()
        {
            SetupContext(IPAddress.Parse("1.2.3.4"), IPAddress.Loopback);

            _controller.PutUpdateData().ContinueWith((t) => { });
            _controller.PutUpdateData().Wait();

            _databasesUpdaterService.Received(2).Update();
        }

        [TestMethod]
        public void PutUpdateData_WhileRebuildIsRunning_ShouldNotUpdate()
        {
            _databasesUpdaterService.Rebuild(Arg.Any<UpdateRequest>()).Returns(Task.Delay(100));
            SetupContext(IPAddress.Parse("1.2.3.4"), IPAddress.Loopback);

            _controller.PostUpdateData(new UpdateRequest()).ContinueWith((t) => { });
            var results = _controller.PutUpdateData().Result as BadRequestObjectResult;

            _databasesUpdaterService.DidNotReceive().Update();
            Assert.IsNotNull(results);
        }
    }
}
