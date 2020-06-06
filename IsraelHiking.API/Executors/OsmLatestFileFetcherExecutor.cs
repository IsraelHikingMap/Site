using IsraelHiking.Common;
using IsraelHiking.Common.Configuration;
using IsraelHiking.DataAccessInterfaces;
using Microsoft.Extensions.FileProviders;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using System.IO;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace IsraelHiking.API.Executors
{
    /// <inheritdoc />
    public class OsmLatestFileFetcherExecutor : IOsmLatestFileFetcherExecutor
    {
        private const string OSM_C_TOOLS_FOLDER = "OsmCTools";
        private const string UPDATES_FILE_NAME = "israel-and-palestine-updates.osc";
        private const string OSM_UPDATE_EXE = "osmup.exe";
        private const string OSM_CONVERT_EXE = "osmconvert.exe";


        private readonly IFileSystemHelper _fileSystemHelper;
        private readonly IProcessHelper _processHelper;
        private readonly IFileProvider _fileProvider;
        private readonly IRemoteFileSizeFetcherGateway _remoteFileFetcherGateway;
        private readonly ILogger _logger;
        private readonly ConfigurationData _options;

        /// <summary>
        /// Constructor
        /// </summary>
        /// <param name="fileSystemHelper"></param>
        /// <param name="processHelper"></param>
        /// <param name="fileProvider"></param>
        /// <param name="options"></param>
        /// <param name="remoteFileFetcherGateway"></param>
        /// <param name="logger"></param>
        public OsmLatestFileFetcherExecutor(IFileSystemHelper fileSystemHelper, 
            IProcessHelper processHelper,
            IFileProvider fileProvider,
            IOptions<ConfigurationData> options, 
            IRemoteFileSizeFetcherGateway remoteFileFetcherGateway,
            ILogger logger)
        {
            _fileSystemHelper = fileSystemHelper;
            _processHelper = processHelper;
            _fileProvider = fileProvider;
            _remoteFileFetcherGateway = remoteFileFetcherGateway;
            _logger = logger;
            _options = options.Value;
        }

        /// <inheritdoc />
        public async Task Update(bool downloadFile = true, bool updateFile = true)
        {
            if (downloadFile == false && updateFile == false)
            {
                return;
            }
            var workingDirectory = Path.Combine(_options.BinariesFolder, OSM_C_TOOLS_FOLDER);
            var directoryContents = _fileProvider.GetDirectoryContents(OSM_C_TOOLS_FOLDER);
            if (!directoryContents.Any())
            {
                _fileSystemHelper.CreateDirectory(workingDirectory);
            }
            if (downloadFile)
            {
                _logger.LogInformation("Starting downloading OSM file.");
                await DownloadDailyOsmFile(workingDirectory);
            }
            if (updateFile)
            {
                _logger.LogInformation("Starting updating to latest OSM file.");
                UpdateFileToLatestVersion(workingDirectory);
            }
            _logger.LogInformation("Finished OSM file manipulation.");
        }

        /// <inheritdoc />
        public Stream Get()
        {
            var fileInfo = _fileProvider.GetFileInfo(Path.Combine(OSM_C_TOOLS_FOLDER, Sources.OSM_FILE_NAME));
            return fileInfo.CreateReadStream();
        }

        private async Task DownloadDailyOsmFile(string workingDirectory)
        {
            var response = await _remoteFileFetcherGateway.GetFileContent(_options.OsmFileAddress);
            _fileSystemHelper.WriteAllBytes(Path.Combine(workingDirectory, Sources.OSM_FILE_NAME), response.Content);
            
            if (!string.IsNullOrWhiteSpace(_options.OsmFileTimeStampAddress))
            {
                // Update timestamp to match the one from the server.
                var file = await _remoteFileFetcherGateway.GetFileContent(_options.OsmFileTimeStampAddress);
                var stringContent = Encoding.UTF8.GetString(file.Content);
                var lastLine = stringContent.Split('\n').Last(s => !string.IsNullOrWhiteSpace(s));
                var timeStamp = lastLine.Split('=').Last().Replace("\\", "");
                RunOsmConvert($"--timestamp={timeStamp} {Sources.OSM_FILE_NAME}", workingDirectory);
            }
        }

        private void UpdateFileToLatestVersion(string workingDirectory)
        {
            _processHelper.Start(OSM_UPDATE_EXE, $"{Sources.OSM_FILE_NAME} {UPDATES_FILE_NAME} --base-url={_options.OsmMinutsFileBaseAddress} --minute", workingDirectory);
            RunOsmConvert($"{Sources.OSM_FILE_NAME} {UPDATES_FILE_NAME}", workingDirectory);
        }
        /// <inheritdoc />
        public Task<Stream> GetUpdates()
        {
            return Task.Run(() =>
            {
                var workingDirectory = Path.Combine(_options.BinariesFolder, OSM_C_TOOLS_FOLDER);
                UpdateFileToLatestVersion(workingDirectory);
                var fileInfo = _fileProvider.GetFileInfo(Path.Combine(OSM_C_TOOLS_FOLDER, UPDATES_FILE_NAME));
                return fileInfo.CreateReadStream();
            });
        }

        private void RunOsmConvert(string parameters, string workingDirectory)
        {
            var tempOsmFileName = $"temp-{Sources.OSM_FILE_NAME}";
            _processHelper.Start(OSM_CONVERT_EXE, $"{parameters} -o={tempOsmFileName}", workingDirectory);
            _fileSystemHelper.Move(Path.Combine(workingDirectory, tempOsmFileName), Path.Combine(workingDirectory, Sources.OSM_FILE_NAME));
        }
   }
}
