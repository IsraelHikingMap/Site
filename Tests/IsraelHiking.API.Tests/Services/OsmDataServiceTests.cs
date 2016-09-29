using System.Collections.Generic;
using System.Threading.Tasks;
using IsraelHiking.API.Services;
using IsraelHiking.Common;
using IsraelHiking.DataAccessInterfaces;
using Microsoft.VisualStudio.TestTools.UnitTesting;
using NetTopologySuite.Features;
using NSubstitute;
using OsmSharp.Osm;

namespace IsraelHiking.API.Tests.Services
{
    [TestClass]
    public class OsmDataServiceTests
    {
        private IOsmDataService _osmDataService;
        private IGraphHopperHelper _graphHopperHelper;
        private IRemoteFileFetcherGateway _remoteFileFetcherGateway;
        private IFileSystemHelper _fileSystemHelper;
        private IElasticSearchGateway _elasticSearchGateway;
        private INssmHelper _elasticSearchHelper;
        private IOsmRepository _osmRepository;
        private IOsmGeoJsonPreprocessor _osmGeoJsonPreprocessor;

        [TestInitialize]
        public void TestInitialize()
        {
            _graphHopperHelper = Substitute.For<IGraphHopperHelper>();
            _remoteFileFetcherGateway = Substitute.For<IRemoteFileFetcherGateway>();
            _fileSystemHelper = Substitute.For<IFileSystemHelper>();
            _elasticSearchGateway = Substitute.For<IElasticSearchGateway>();
            _elasticSearchHelper = Substitute.For<INssmHelper>();
            _osmRepository = Substitute.For<IOsmRepository>();
            _osmGeoJsonPreprocessor = Substitute.For<IOsmGeoJsonPreprocessor>();
            _osmDataService = new OsmDataService(_graphHopperHelper, _remoteFileFetcherGateway, _fileSystemHelper,
                _elasticSearchGateway, _elasticSearchHelper, _osmRepository, _osmGeoJsonPreprocessor, Substitute.For<ILogger>());
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
            _remoteFileFetcherGateway.GetFileSize(Arg.Any<string>()).Returns(Task.FromResult((long)10));
            _fileSystemHelper.GetFileSize(Arg.Any<string>()).Returns(1);
            _remoteFileFetcherGateway.GetFileContent(Arg.Any<string>()).Returns(Task.FromResult(new RemoteFileFetcherGatewayResponse()));

            _osmDataService.Initialize(string.Empty);
            _osmDataService.UpdateData(OsmDataServiceOperations.GetOsmFile).Wait();

            _remoteFileFetcherGateway.Received(1).GetFileContent(Arg.Any<string>());
            _fileSystemHelper.Received(1).WriteAllBytes(Arg.Any<string>(), Arg.Any<byte[]>());
        }

        [TestMethod]
        public void UpdateData_UpdateElasticSearchTwoNodes_ShouldUpdateGraphHopper()
        {
            _osmGeoJsonPreprocessor.Preprocess(Arg.Any<Dictionary<string, List<ICompleteOsmGeo>>>())
                .Returns(new Dictionary<string, List<Feature>> { { "name", new List<Feature> { new Feature()} } });
            _fileSystemHelper.Exists(Arg.Any<string>()).Returns(true);

            _osmDataService.Initialize(string.Empty);
            _osmDataService.UpdateData(OsmDataServiceOperations.UpdateElasticSearch).Wait();

            _osmRepository.Received(1).GetElementsWithName(Arg.Any<string>());
            _elasticSearchGateway.Received(1).UpdateData(Arg.Any<List<Feature>>());
        }


        [TestMethod]
        public void UpdateData_UpdateGraphHopper_ShouldUpdateGraphHopper()
        {
            _fileSystemHelper.Exists(Arg.Any<string>()).Returns(true);

            _osmDataService.Initialize(string.Empty);
            _osmDataService.UpdateData(OsmDataServiceOperations.UpdateGraphHopper).Wait();

            _graphHopperHelper.Received(1).UpdateData(Arg.Any<string>());
        }
    }
}
