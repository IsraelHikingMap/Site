using System.Collections.Generic;
using System.IO;
using IsraelHiking.API.Executors;
using IsraelHiking.API.Services.Osm;
using IsraelHiking.Common;
using IsraelHiking.DataAccessInterfaces;
using Microsoft.Owin.FileSystems;
using Microsoft.VisualStudio.TestTools.UnitTesting;
using NetTopologySuite.Features;
using NSubstitute;
using OsmSharp.Osm;

namespace IsraelHiking.API.Tests.Services.Osm
{
    [TestClass]
    public class OsmDataServiceTests
    {
        private IOsmDataService _osmDataService;
        private IGraphHopperHelper _graphHopperHelper;
        private IRemoteFileFetcherGateway _remoteFileFetcherGateway;
        private IRemoteFileSizeFetcherGateway _remoteFileSizeFetcherGateway;
        private IFileProvider _fileProvider;
        private IFileSystemHelper _fileSystemHelper;
        private IElasticSearchGateway _elasticSearchGateway;
        private INssmHelper _elasticSearchHelper;
        private IOsmRepository _osmRepository;
        private IOsmGeoJsonPreprocessorExecutor _osmGeoJsonPreprocessorExecutor;

        [TestInitialize]
        public void TestInitialize()
        {
            _graphHopperHelper = Substitute.For<IGraphHopperHelper>();
            _remoteFileFetcherGateway = Substitute.For<IRemoteFileFetcherGateway>();
            var factory = Substitute.For<IHttpGatewayFactory>();
            factory.CreateRemoteFileFetcherGateway(Arg.Any<TokenAndSecret>()).Returns(_remoteFileFetcherGateway);
            _remoteFileSizeFetcherGateway = Substitute.For<IRemoteFileSizeFetcherGateway>();
            _fileProvider = Substitute.For<IFileProvider>();
            _fileSystemHelper = Substitute.For<IFileSystemHelper>();
            _elasticSearchGateway = Substitute.For<IElasticSearchGateway>();
            _elasticSearchHelper = Substitute.For<INssmHelper>();
            _osmRepository = Substitute.For<IOsmRepository>();
            _osmGeoJsonPreprocessorExecutor = Substitute.For<IOsmGeoJsonPreprocessorExecutor>();
            _osmDataService = new OsmDataService(_graphHopperHelper, factory, _remoteFileSizeFetcherGateway, _fileProvider, _fileSystemHelper,
                _elasticSearchGateway, _elasticSearchHelper, _osmRepository, _osmGeoJsonPreprocessorExecutor, Substitute.For<ILogger>());
        }

        [TestMethod]
        public void Initialize_ShouldInitializeAllServices()
        {
            var serverPath = "serverPath";

            _osmDataService.Initialize(serverPath).Wait();

            _graphHopperHelper.Received(1).Initialize(serverPath);
            _elasticSearchHelper.Received(1).Initialize(serverPath);
        }

        [TestMethod]
        public void UpdateData_NotInitialized_ShouldThrowsExceptionButNotFail()
        {
            _osmDataService.UpdateData(OsmDataServiceOperations.UpdateGraphHopper).Wait();

            _graphHopperHelper.DidNotReceive().UpdateData(Arg.Any<string>());
        }

        [TestMethod]
        public void UpdateData_NoneAction_ShouldDoNothing()
        {
            _osmDataService.UpdateData(OsmDataServiceOperations.None).Wait();

            _remoteFileFetcherGateway.DidNotReceive().GetFileContent(Arg.Any<string>());
        }

        [TestMethod]
        public void UpdateData_GetOsmFileWhenCurrentFileIsInDeifferentSize_ShouldGetTheFileFromTheWeb()
        {
            _remoteFileSizeFetcherGateway.GetFileSize(Arg.Any<string>()).Returns(10);
            var fileInfo = Substitute.For<IFileInfo>();
            fileInfo.Length.Returns(1);
            _fileProvider.GetFileInfo(Arg.Any<string>()).Returns(fileInfo);
            _remoteFileFetcherGateway.GetFileContent(Arg.Any<string>()).Returns(new RemoteFileFetcherGatewayResponse());

            _osmDataService.Initialize(string.Empty);
            _osmDataService.UpdateData(OsmDataServiceOperations.GetOsmFile).Wait();

            _remoteFileFetcherGateway.Received(1).GetFileContent(Arg.Any<string>());
            _fileSystemHelper.Received(1).WriteAllBytes(Arg.Any<string>(), Arg.Any<byte[]>());
        }

        [TestMethod]
        public void UpdateData_UpdateElasticSearchTwoNodes_ShouldUpdateGraphHopper()
        {
            _osmGeoJsonPreprocessorExecutor.Preprocess(Arg.Any<Dictionary<string, List<ICompleteOsmGeo>>>())
                .Returns(new Dictionary<string, List<Feature>> { { "name", new List<Feature> { new Feature() } } });
            var fileInfo = Substitute.For<IFileInfo>();
            fileInfo.PhysicalPath.Returns(Directory.GetCurrentDirectory());
            _fileProvider.GetFileInfo(Arg.Any<string>()).Returns(fileInfo);

            _osmDataService.Initialize(string.Empty);
            _osmDataService.UpdateData(OsmDataServiceOperations.UpdateElasticSearch).Wait();

            _osmRepository.Received(1).GetElementsWithName(Arg.Any<string>());
            _elasticSearchGateway.Received(1).UpdateNamesData(Arg.Any<List<Feature>>());
        }


        [TestMethod]
        public void UpdateData_UpdateGraphHopper_ShouldUpdateGraphHopper()
        {
            var fileInfo = Substitute.For<IFileInfo>();
            fileInfo.PhysicalPath.Returns(Directory.GetCurrentDirectory());
            _fileProvider.GetFileInfo(Arg.Any<string>()).Returns(fileInfo);

            _osmDataService.Initialize(string.Empty);
            _osmDataService.UpdateData(OsmDataServiceOperations.UpdateGraphHopper).Wait();

            _graphHopperHelper.Received(1).UpdateData(Arg.Any<string>());
        }
    }
}
