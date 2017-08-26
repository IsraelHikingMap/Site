using System.Collections.Generic;
using System.IO;
using System.Net;
using IsraelHiking.API.Controllers;
using IsraelHiking.API.Executors;
using IsraelHiking.API.Services.Poi;
using IsraelHiking.DataAccessInterfaces;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Logging;
using Microsoft.VisualStudio.TestTools.UnitTesting;
using NetTopologySuite.Features;
using NSubstitute;
using OsmSharp.Complete;

namespace IsraelHiking.API.Tests.Controllers
{
    [TestClass]
    public class UpdateControllerTests
    {
        private UpdateController _updateController;
        private IGraphHopperGateway _graphHopperGateway;
        private IElasticSearchGateway _elasticSearchGateway;
        private IOsmRepository _osmRepository;
        private IOsmGeoJsonPreprocessorExecutor _geoJsonPreprocessorExecutor;

        [TestInitialize]
        public void TestInitialize()
        {
            _graphHopperGateway = Substitute.For<IGraphHopperGateway>();
            _elasticSearchGateway = Substitute.For<IElasticSearchGateway>();
            _osmRepository = Substitute.For<IOsmRepository>();
            _geoJsonPreprocessorExecutor = Substitute.For<IOsmGeoJsonPreprocessorExecutor>();
            var logger = Substitute.For<ILogger>();
            _updateController = new UpdateController(_graphHopperGateway, _elasticSearchGateway, _geoJsonPreprocessorExecutor, _osmRepository, new List<IPointsOfInterestAdapter>(), logger);
        }

        private void SetupContext(IPAddress localIp, IPAddress remoteIp)
        {
            _updateController.ControllerContext = new ControllerContext
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
            
            var results = _updateController.PostUpdateData(null).Result;
            
            Assert.IsNotNull(results as BadRequestObjectResult);
        }

        [TestMethod]
        public void PostUpdateData_FileIsNull_ShouldReturnBadRequest()
        {
            SetupContext(IPAddress.Parse("1.2.3.4"), IPAddress.Loopback);
            
            var results = _updateController.PostUpdateData(null).Result;

            Assert.IsNotNull(results as BadRequestObjectResult);
        }

        [TestMethod]
        public void PostUpdateData_RemoteIs10101010_ShouldUpdateGateways()
        {
            SetupContext(IPAddress.Parse("1.2.3.4"), IPAddress.Parse("10.10.10.10"));
            var file = Substitute.For<IFormFile>();
            file.FileName.Returns("somefile.pbf");
            file.OpenReadStream().Returns(new MemoryStream(new byte[] { 1 }));
            _geoJsonPreprocessorExecutor.Preprocess(Arg.Any<Dictionary<string, List<ICompleteOsmGeo>>>()).Returns(new Dictionary<string, List<Feature>>());
            
            _updateController.PostUpdateData(file).Wait();

            _graphHopperGateway.Received(1).Rebuild(Arg.Any<MemoryStream>(), Arg.Any<string>());
            _elasticSearchGateway.Received(1).UpdateDataZeroDownTime(Arg.Any<List<Feature>>(), Arg.Any<List<Feature>>());
        }
    }
}
