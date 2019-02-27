using System.IO;
using IsraelHiking.API.Controllers;
using IsraelHiking.API.Services;
using IsraelHiking.Common;
using IsraelHiking.DataAccessInterfaces;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using Microsoft.VisualStudio.TestTools.UnitTesting;
using NSubstitute;
using OsmSharp.API;

namespace IsraelHiking.API.Tests.Controllers
{
    [TestClass]
    public class OsmTracesControllerTests 
    {
        private OsmTracesController _controller;
        private IHttpGatewayFactory _httpGatewayFactory;

        [TestInitialize]
        public void TestInitialize()
        {
            _httpGatewayFactory = Substitute.For<IHttpGatewayFactory>();
            var options = new ConfigurationData();
            var optionsProvider = Substitute.For<IOptions<ConfigurationData>>();
            optionsProvider.Value.Returns(options);
            _controller = new OsmTracesController(_httpGatewayFactory, new LruCache<string, TokenAndSecret>(optionsProvider, Substitute.For<ILogger>()));   
        }

        [TestMethod]
        public void GetTraces_ShouldGetThemFromOsm()
        {
            _controller.SetupIdentity();
            var osmGateWay = Substitute.For<IOsmGateway>();
            _httpGatewayFactory.CreateOsmGateway(Arg.Any<TokenAndSecret>()).Returns(osmGateWay);

            _controller.GetTraces().Wait();

            osmGateWay.Received(1).GetTraces();
        }

        [TestMethod]
        public void PostUploadGpsTrace_NoFile_ShouldReturnBadRequest()
        {
            var results = _controller.PostUploadGpsTrace(null).Result as BadRequestResult;

            Assert.IsNotNull(results);
        }

        [TestMethod]
        public void PostUploadGpsTrace_UploadFile_ShouldSendItToOsmGateway()
        {
            var file = Substitute.For<IFormFile>();
            file.FileName.Returns("SomeFile.gpx");
            var gateway = Substitute.For<IOsmGateway>();
            _httpGatewayFactory.CreateOsmGateway(Arg.Any<TokenAndSecret>()).Returns(gateway);
            _controller.SetupIdentity();
        
            _controller.PostUploadGpsTrace(file).Wait();
        
            gateway.Received(1).CreateTrace(Arg.Any<string>(), Arg.Any<MemoryStream>());
        }


        [TestMethod]
        public void PutGpsTrace_ShouldUpdate()
        {
            _controller.SetupIdentity();
            var osmGateWay = Substitute.For<IOsmGateway>();
            _httpGatewayFactory.CreateOsmGateway(Arg.Any<TokenAndSecret>()).Returns(osmGateWay);

            _controller.PutGpsTrace("42", new GpxFile()).Wait();

            osmGateWay.Received(1).UpdateTrace(Arg.Any<GpxFile>());
        }

        [TestMethod]
        public void DeleteGpsTrace_ShouldDeleteIt()
        {
            var id = "id";
            _controller.SetupIdentity();
            var osmGateWay = Substitute.For<IOsmGateway>();
            _httpGatewayFactory.CreateOsmGateway(Arg.Any<TokenAndSecret>()).Returns(osmGateWay);

            _controller.DeleteGpsTrace(id).Wait();

            osmGateWay.Received(1).DeleteTrace(id);
        }
    }
}
