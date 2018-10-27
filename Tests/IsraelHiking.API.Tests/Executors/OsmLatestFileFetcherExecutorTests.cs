using System.Text;
using IsraelHiking.API.Executors;
using IsraelHiking.Common;
using IsraelHiking.DataAccessInterfaces;
using Microsoft.Extensions.FileProviders;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using Microsoft.VisualStudio.TestTools.UnitTesting;
using NSubstitute;

namespace IsraelHiking.API.Tests.Executors
{
    [TestClass]
    public class OsmLatestFileFetcherExecutorTests
    {
        private IOsmLatestFileFetcherExecutor _fetcher;
        private IFileSystemHelper _fileSystemHelper;
        private IFileProvider _fileProvider;
        private IRemoteFileSizeFetcherGateway _remoteFileSizeFetcherGateway;
        private IProcessHelper _processHelper;

        [TestInitialize]
        public void TestInitialize()
        {
            _fileSystemHelper = Substitute.For<IFileSystemHelper>();
            _processHelper = Substitute.For<IProcessHelper>();
            _fileProvider = Substitute.For<IFileProvider>();
            _remoteFileSizeFetcherGateway = Substitute.For<IRemoteFileSizeFetcherGateway>();
            var options = Substitute.For<IOptions<ConfigurationData>>();
            options.Value.Returns(new ConfigurationData());
            _fetcher = new OsmLatestFileFetcherExecutor(_fileSystemHelper, _processHelper, _fileProvider, options, _remoteFileSizeFetcherGateway, Substitute.For<ILogger>());
        }

        [TestMethod]
        public void Update_EmptyDirectory_ShouldFetchFileAndUpdateIt()
        {
            _fileProvider.GetDirectoryContents(Arg.Any<string>()).Returns(Substitute.For<IDirectoryContents>());
            _remoteFileSizeFetcherGateway.GetFileContent(Arg.Any<string>()).Returns(new RemoteFileFetcherGatewayResponse());
            _remoteFileSizeFetcherGateway.GetFileContent(Arg.Is<string>(x => x.EndsWith("txt"))).Returns(new RemoteFileFetcherGatewayResponse { Content = Encoding.UTF8.GetBytes("a=b")});

            _fetcher.Update().Wait();

            _processHelper.Received(2).Start(Arg.Any<string>(), Arg.Any<string>(), Arg.Any<string>());
        }

        [TestMethod]
        public void GetUpdates_ShouldFetchFile()
        {
            _fetcher.GetUpdates().Wait();

            _processHelper.Received(2).Start(Arg.Any<string>(), Arg.Any<string>(), Arg.Any<string>());
        }
    }
}
