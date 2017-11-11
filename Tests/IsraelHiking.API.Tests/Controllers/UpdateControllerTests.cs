using System.Collections.Generic;
using System.IO;
using System.Net;
using IsraelHiking.API.Controllers;
using IsraelHiking.API.Executors;
using IsraelHiking.API.Services.Poi;
using IsraelHiking.Common;
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
        private IOsmLatestFileFetcher _osmLatestFileFetcher;

        [TestInitialize]
        public void TestInitialize()
        {
            _graphHopperGateway = Substitute.For<IGraphHopperGateway>();
            _elasticSearchGateway = Substitute.For<IElasticSearchGateway>();
            _osmRepository = Substitute.For<IOsmRepository>();
            _geoJsonPreprocessorExecutor = Substitute.For<IOsmGeoJsonPreprocessorExecutor>();
            _osmLatestFileFetcher = Substitute.For<IOsmLatestFileFetcher>();
            var logger = Substitute.For<ILogger>();
            _updateController = new UpdateController(_graphHopperGateway, _elasticSearchGateway, _geoJsonPreprocessorExecutor, _osmRepository, _osmLatestFileFetcher, new List<IPointsOfInterestAdapter>(), logger);
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
        public void PostUpdateData_RequestIsNull_ShouldUpdateAllGateways()
        {
            SetupContext(IPAddress.Parse("1.2.3.4"), IPAddress.Loopback);
            _osmLatestFileFetcher.Get().Returns(new MemoryStream(new byte[] { 1 }));

            _updateController.PostUpdateData(null).Wait();

            _graphHopperGateway.Received(1).Rebuild(Arg.Any<MemoryStream>(), Arg.Any<string>());
            _elasticSearchGateway.Received(1).UpdateHighwaysZeroDownTime(Arg.Any<List<Feature>>());
            _elasticSearchGateway.Received(1).UpdatePointsOfInterestZeroDownTime(Arg.Any<List<Feature>>());
        }

        [TestMethod]
        public void PostUpdateData_RemoteIs10101010Defaultrequest_ShouldUpdateAllGateways()
        {
            SetupContext(IPAddress.Parse("1.2.3.4"), IPAddress.Parse("10.10.10.10"));
            _osmLatestFileFetcher.Get().Returns(new MemoryStream(new byte[] {1}));
            _geoJsonPreprocessorExecutor.Preprocess(Arg.Any<Dictionary<string, List<ICompleteOsmGeo>>>()).Returns(new Dictionary<string, List<Feature>>());
            
            _updateController.PostUpdateData(new UpdateRequest()).Wait();

            _graphHopperGateway.Received(1).Rebuild(Arg.Any<MemoryStream>(), Arg.Any<string>());
            _elasticSearchGateway.Received(1).UpdateHighwaysZeroDownTime(Arg.Any<List<Feature>>());
            _elasticSearchGateway.Received(1).UpdatePointsOfInterestZeroDownTime(Arg.Any<List<Feature>>());
        }
    }
}
