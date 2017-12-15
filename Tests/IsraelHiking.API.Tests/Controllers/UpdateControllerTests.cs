using System.IO;
using System.Net;
using System.Threading.Tasks;
using System.Xml.Serialization;
using IsraelHiking.API.Controllers;
using IsraelHiking.API.Executors;
using IsraelHiking.API.Services.Osm;
using IsraelHiking.Common;
using IsraelHiking.DataAccessInterfaces;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Logging;
using Microsoft.VisualStudio.TestTools.UnitTesting;
using NSubstitute;
using OsmSharp;
using OsmSharp.Changesets;

namespace IsraelHiking.API.Tests.Controllers
{
    [TestClass]
    public class UpdateControllerTests
    {
        private UpdateController _controller;
        private IGraphHopperGateway _graphHopperGateway;
        private IOsmLatestFileFetcher _osmLatestFileFetcher;
        private IOsmElasticSearchUpdaterService _osmElasticSearchUpdaterService;

        [TestInitialize]
        public void TestInitialize()
        {
            _graphHopperGateway = Substitute.For<IGraphHopperGateway>();
            _osmLatestFileFetcher = Substitute.For<IOsmLatestFileFetcher>();
            var logger = Substitute.For<ILogger>();
            _osmElasticSearchUpdaterService = Substitute.For<IOsmElasticSearchUpdaterService>();
            _controller = new UpdateController(_graphHopperGateway, _osmLatestFileFetcher, _osmElasticSearchUpdaterService, logger);
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
            _osmLatestFileFetcher.Get().Returns(new MemoryStream(new byte[] { 1 }));

            _controller.PostUpdateData(null).Wait();

            _graphHopperGateway.Received(1).Rebuild(Arg.Any<MemoryStream>(), Arg.Any<string>());
            _osmElasticSearchUpdaterService.Received(1).Rebuild(Arg.Any<UpdateRequest>(), Arg.Any<Stream>());
            
        }

        [TestMethod]
        public void PostUpdateData_RemoteIs10101010Defaultrequest_ShouldUpdateAllGateways()
        {
            SetupContext(IPAddress.Parse("1.2.3.4"), IPAddress.Parse("10.10.10.10"));
            _osmLatestFileFetcher.Get().Returns(new MemoryStream(new byte[] {1}));
            
            _controller.PostUpdateData(new UpdateRequest()).Wait();

            _graphHopperGateway.Received(1).Rebuild(Arg.Any<MemoryStream>(), Arg.Any<string>());
            _osmElasticSearchUpdaterService.Received(1).Rebuild(Arg.Any<UpdateRequest>(), Arg.Any<Stream>());
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
            var changes = new OsmChange {Create = new OsmGeo[] {new Node()}};
            _osmLatestFileFetcher.GetUpdates().Returns(CreateStream(changes));
            SetupContext(IPAddress.Parse("1.2.3.4"), IPAddress.Loopback);

            _controller.PutUpdateData().Wait();

            _osmElasticSearchUpdaterService.Received(1).Update(Arg.Is<OsmChange>(x => x.Create.Length == changes.Create.Length));
        }

        [TestMethod]
        public void PutUpdateData_FromTwoThreads_ShouldUpdateTwice()
        {
            var changes = new OsmChange {Create = new OsmGeo[] {new Node()}};
            
            _osmLatestFileFetcher.GetUpdates().Returns(CreateStream(changes), CreateStream(changes));
            SetupContext(IPAddress.Parse("1.2.3.4"), IPAddress.Loopback);

            _controller.PutUpdateData().ContinueWith((t) => { });
            _controller.PutUpdateData().Wait();

            _osmElasticSearchUpdaterService.Received(2).Update(Arg.Is<OsmChange>(x => x.Create.Length == changes.Create.Length));
        }

        [TestMethod]
        public void PutUpdateData_WhileRebuildIsRunning_ShouldNotUpdate()
        {
            var changes = new OsmChange { Create = new OsmGeo[] { new Node() } };
            _osmLatestFileFetcher.Get().Returns(CreateStream(changes));
            _osmLatestFileFetcher.GetUpdates().Returns(CreateStream(changes));
            SetupContext(IPAddress.Parse("1.2.3.4"), IPAddress.Loopback);

            _controller.PostUpdateData(new UpdateRequest()).ContinueWith((t) => { });
            var results = _controller.PutUpdateData().Result as BadRequestObjectResult;

            _osmElasticSearchUpdaterService.DidNotReceive().Update(Arg.Is<OsmChange>(x => x.Create.Length == changes.Create.Length));
            Assert.IsNotNull(results);
        }

        private async Task<Stream> CreateStream(OsmChange changes)
        {
            await Task.Delay(100);
            Stream stream = new MemoryStream();
            var serializer = new XmlSerializer(typeof(OsmChange));
            serializer.Serialize(stream, changes);
            stream.Seek(0, SeekOrigin.Begin);
            return stream;
        }
    }
}
