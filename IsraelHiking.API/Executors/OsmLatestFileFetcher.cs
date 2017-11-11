using System.IO;
using System.Linq;
using System.Threading.Tasks;
using IsraelHiking.Common;
using IsraelHiking.DataAccessInterfaces;
using Microsoft.Extensions.FileProviders;
using Microsoft.Extensions.Options;

namespace IsraelHiking.API.Executors
{
    /// <inheritdoc />
    public class OsmLatestFileFetcher : IOsmLatestFileFetcher
    {
        private const string GEO_FABRIK_ADDRESS = "http://download.geofabrik.de/asia/israel-and-palestine-latest.osm.pbf";

        private readonly IFileSystemHelper _fileSystemHelper;
        private readonly IProcessHelper _processHelper;
        private readonly IFileProvider _fileProvider;
        private readonly IRemoteFileSizeFetcherGateway _remoteFileFetcherGateway;
        private readonly ConfigurationData _options;

        /// <summary>
        /// Constructor
        /// </summary>
        /// <param name="fileSystemHelper"></param>
        /// <param name="processHelper"></param>
        /// <param name="fileProvider"></param>
        /// <param name="options"></param>
        /// <param name="remoteFileFetcherGateway"></param>
        public OsmLatestFileFetcher(IFileSystemHelper fileSystemHelper, 
            IProcessHelper processHelper,
            IFileProvider fileProvider,
            IOptions<ConfigurationData> options, IRemoteFileSizeFetcherGateway remoteFileFetcherGateway)
        {
            _fileSystemHelper = fileSystemHelper;
            _processHelper = processHelper;
            _fileProvider = fileProvider;
            _remoteFileFetcherGateway = remoteFileFetcherGateway;
            _options = options.Value;
        }

        /// <inheritdoc />
        public async Task<Stream> Get()
        {
            var workingDirectory = Path.Combine(_options.BinariesFolder, _options.SiteCacheFolder);
            var directoryContents = _fileProvider.GetDirectoryContents(_options.SiteCacheFolder);
            if (!directoryContents.Any())
            {
                _fileSystemHelper.CreateDirectory(workingDirectory);
            }
            var remoteFileSize = await _remoteFileFetcherGateway.GetFileSize(GEO_FABRIK_ADDRESS);
            if (directoryContents.FirstOrDefault(f => f.Name == Sources.OSM_FILE_NAME) == null)
            {
                await DownloadLatestOsmFile(workingDirectory);
            }
            var fileInfo = _fileProvider.GetFileInfo(Path.Combine(_options.SiteCacheFolder, Sources.OSM_FILE_NAME));
            if (fileInfo.Length != remoteFileSize)
            {
                await DownloadLatestOsmFile(workingDirectory);
            }
            
            // HM TODO: update OSM file using minutes updates?
            //var fileName = "osmup.exe";
            //var processArguments = $@"osmup.exe {osmFile} NUL.osc --base-url=http://download.openstreetmap.fr/replication/asia/israel_and_palestine --minute --tempfiles=openstreetmap_fr\asia\israel_and_palestine --keep-tempfiles --trust-tempfiles";
            //_processHelper.Start(fileName, processArguments, workingDirectory);

            return fileInfo.CreateReadStream();
        }

        private async Task DownloadLatestOsmFile(string workingDirectory)
        {
            var response = await _remoteFileFetcherGateway.GetFileContent(GEO_FABRIK_ADDRESS);
            _fileSystemHelper.WriteAllBytes(Path.Combine(workingDirectory, Sources.OSM_FILE_NAME), response.Content);
        }
    }
}
