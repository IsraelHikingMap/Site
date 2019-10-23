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
using OsmSharp.IO.API;

namespace IsraelHiking.API.Tests.Controllers
{
    [TestClass]
    public class OsmTracesControllerTests 
    {
        private OsmTracesController _controller;
        private IClientsFactory _clientsFactory;
        private LruCache<string, TokenAndSecret> _cache;

        [TestInitialize]
        public void TestInitialize()
        {
            _clientsFactory = Substitute.For<IClientsFactory>();
            var options = new ConfigurationData();
            var optionsProvider = Substitute.For<IOptions<ConfigurationData>>();
            optionsProvider.Value.Returns(options);
            _cache = new LruCache<string, TokenAndSecret>(optionsProvider, Substitute.For<ILogger>());
            _controller = new OsmTracesController(_clientsFactory, Substitute.For<IElevationDataStorage>(), Substitute.For<IDataContainerConverterService>(), optionsProvider, Substitute.For<IImageCreationService>(), _cache);
        }

        [TestMethod]
        public void GetTraces_ShouldGetThemFromOsm()
        {
            _controller.SetupIdentity(_cache);
            var osmGateWay = SetupOAuthClient();

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
            var osmGateWay = SetupOAuthClient();

            _controller.SetupIdentity(_cache);
        
            _controller.PostUploadGpsTrace(file).Wait();

            osmGateWay.Received(1).CreateTrace(Arg.Any<GpxFile>(), Arg.Any<MemoryStream>());
        }


        [TestMethod]
        public void PutGpsTrace_ShouldUpdate()
        {
            _controller.SetupIdentity(_cache);
            var osmGateWay = SetupOAuthClient();

            _controller.PutGpsTrace("42", new Trace { Id = "7", Visibility = "public" }).Wait();

            osmGateWay.Received(1).UpdateTrace(Arg.Any<GpxFile>());
        }

        [TestMethod]
        public void DeleteGpsTrace_ShouldDeleteIt()
        {
            long id = 1;
            _controller.SetupIdentity(_cache);
            var osmGateWay = SetupOAuthClient();

            _controller.DeleteGpsTrace(id).Wait();

            osmGateWay.Received(1).DeleteTrace(id);
        }

        private IAuthClient SetupOAuthClient()
        {
            var osmGateWay = Substitute.For<IAuthClient>();
            _clientsFactory.CreateOAuthClient(Arg.Any<string>(), Arg.Any<string>(), Arg.Any<string>(), Arg.Any<string>()).Returns(osmGateWay);
            return osmGateWay;
        }
    }
}
