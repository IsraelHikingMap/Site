using System;
using System.Collections.Generic;
using System.IO;
using System.Threading.Tasks;
using IsraelHiking.API.Executors;
using IsraelHiking.DataAccessInterfaces;
using NetTopologySuite.Features;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.FileProviders;

namespace IsraelHiking.API.Services.Osm
{
    /// <inheritdoc />
    public class OsmDataService : IOsmDataService
    {
        private const string PBF_FILE_NAME = "israel-and-palestine-latest.osm.pbf";
        private const int PAGE_SIZE = 10000;

        private readonly ILogger _logger;
        private readonly IHttpGatewayFactory _httpGatewayFactory;
        private readonly IRemoteFileSizeFetcherGateway _remoteFileSizeFetcherGateway;
        private readonly IGraphHopperHelper _graphHopperHelper;
        private readonly INssmHelper _elasticSearchHelper;
        private readonly IFileProvider _fileProvider;
        private readonly IFileSystemHelper _fileSystemHelper;
        private readonly IElasticSearchGateway _elasticSearchGateway;
        private readonly IOsmGeoJsonPreprocessorExecutor _osmGeoJsonPreprocessorExecutor;
        private readonly IOsmRepository _osmRepository;
        private string _serverPath;

        /// <summary>
        /// Constructor
        /// </summary>
        /// <param name="graphHopperHelper"></param>
        /// <param name="httpGatewayFactory"></param>
        /// <param name="remoteFileSizeFetcherGateway"></param>
        /// <param name="fileProvider"></param>
        /// <param name="fileSystemHelper"></param>
        /// <param name="elasticSearchGateway"></param>
        /// <param name="elasticSearchHelper"></param>
        /// <param name="osmRepository"></param>
        /// <param name="osmGeoJsonPreprocessorExecutor"></param>
        /// <param name="logger"></param>
        public OsmDataService(IGraphHopperHelper graphHopperHelper,
            IHttpGatewayFactory httpGatewayFactory,
            IRemoteFileSizeFetcherGateway remoteFileSizeFetcherGateway,
            IFileProvider fileProvider,
            IFileSystemHelper fileSystemHelper,
            IElasticSearchGateway elasticSearchGateway,
            INssmHelper elasticSearchHelper,
            IOsmRepository osmRepository,
            IOsmGeoJsonPreprocessorExecutor osmGeoJsonPreprocessorExecutor,
            ILogger logger)
        {
            _graphHopperHelper = graphHopperHelper;
            _httpGatewayFactory = httpGatewayFactory;
            _remoteFileSizeFetcherGateway = remoteFileSizeFetcherGateway;
            _fileProvider = fileProvider;
            _fileSystemHelper = fileSystemHelper;
            _elasticSearchGateway = elasticSearchGateway;
            _elasticSearchHelper = elasticSearchHelper;
            _osmRepository = osmRepository;
            _osmGeoJsonPreprocessorExecutor = osmGeoJsonPreprocessorExecutor;
            _logger = logger;   
        }

        /// <inheritdoc />
        public async Task Initialize(string serverPath)
        {
            _serverPath = serverPath;
            _logger.LogInformation("Initializing OSM data service with server path: " + _serverPath);
            await _graphHopperHelper.Initialize(_serverPath);
            await _elasticSearchHelper.Initialize(_serverPath);
            _logger.LogInformation("Finished initializing OSM data service with server path: " + _serverPath);
        }

        /// <inheritdoc />
        public async Task UpdateData(OsmDataServiceOperations operations)
        {
            try
            {
                if (operations == OsmDataServiceOperations.None)
                {
                    _logger.LogWarning("No operations are requested, doing nothing...");
                    return;
                }
                _logger.LogInformation("Updating OSM data");
                var osmFileFullPath = Path.Combine(_serverPath, PBF_FILE_NAME);
                if ((operations & OsmDataServiceOperations.GetOsmFile) != 0)
                {
                    await FetchOsmFile(osmFileFullPath);
                }
                if (_fileProvider.GetFileInfo(PBF_FILE_NAME).Exists == false)
                {
                    _logger.LogError(osmFileFullPath + " File is missing. Fatal error - exiting.");
                    return;
                }
                if ((operations & OsmDataServiceOperations.UpdateElasticSearch) != 0)
                {
                    await UpdateElasticSearchFromFile(PBF_FILE_NAME);
                }
                if ((operations & OsmDataServiceOperations.UpdateGraphHopper) != 0)
                {
                    await _graphHopperHelper.UpdateData(osmFileFullPath);
                }
                _logger.LogInformation("Finished Updating OSM data");
            }
            catch (Exception ex)
            {
                _logger.LogError(ex.ToString());
            }
        }

        private async Task FetchOsmFile(string osmFullFilePath)
        {
            var address = "http://download.geofabrik.de/asia/" + PBF_FILE_NAME;
            var length = await _remoteFileSizeFetcherGateway.GetFileSize(address);
            var fileInfo = _fileProvider.GetFileInfo(PBF_FILE_NAME);
            if (!fileInfo.Exists || fileInfo.Length != length)
            {
                _logger.LogInformation("Downloading OSM database file");
                var response = await _httpGatewayFactory.CreateRemoteFileFetcherGateway(null).GetFileContent(address);
                _fileSystemHelper.WriteAllBytes(osmFullFilePath, response.Content);
                _logger.LogInformation("Finished downloading OSM database file");
            }
            else
            {
                _logger.LogInformation("No need to download OSM database file, existing file size is the same as the server");
            }
        }

        private async Task UpdateElasticSearchFromFile(string osmFileRelativePath)
        {
            _logger.LogInformation("Updating Elastic Search OSM data");
            var osmNamesDictionary = await _osmRepository.GetElementsWithName(osmFileRelativePath);
            var geoJsonNamesDictionary = _osmGeoJsonPreprocessorExecutor.Preprocess(osmNamesDictionary);
            var osmHighways = await _osmRepository.GetAllHighways(osmFileRelativePath);
            var geoJsonHighways = _osmGeoJsonPreprocessorExecutor.Preprocess(osmHighways);
            _elasticSearchGateway.Initialize(deleteIndex: true);
            UpdateElesticSearchNamesDataUsingPaging(geoJsonNamesDictionary);
            UpdateElesticSearchHighwaysDataUsingPaging(geoJsonHighways);
        }

        private void UpdateElesticSearchNamesDataUsingPaging(Dictionary<string, List<Feature>> geoJsonNamesDictionary)
        {
            var smallCahceList = new List<Feature>(PAGE_SIZE);
            int total = 0;
            foreach (var name in geoJsonNamesDictionary.Keys)
            {
                smallCahceList.AddRange(geoJsonNamesDictionary[name]);
                if (smallCahceList.Count < PAGE_SIZE)
                {
                    continue;
                }
                total += smallCahceList.Count;
                _logger.LogInformation($"Indexing {total} records");
                _elasticSearchGateway.UpdateNamesData(smallCahceList).Wait();
                smallCahceList.Clear();
            }
            _elasticSearchGateway.UpdateNamesData(smallCahceList).Wait();
            _logger.LogInformation($"Finished updating Elastic Search names, Indexed {total + smallCahceList.Count} records");
        }

        private void UpdateElesticSearchHighwaysDataUsingPaging(List<Feature> highways)
        {
            var smallCahceList = new List<Feature>(PAGE_SIZE);
            int total = 0;
            foreach (var highway in highways)
            {
                smallCahceList.Add(highway);
                if (smallCahceList.Count < PAGE_SIZE)
                {
                    continue;
                }
                total += smallCahceList.Count;
                _logger.LogInformation($"Indexing {total} records");
                _elasticSearchGateway.UpdateHighwaysData(smallCahceList).Wait();
                smallCahceList.Clear();
            }
            _elasticSearchGateway.UpdateHighwaysData(smallCahceList).Wait();
            _logger.LogInformation($"Finished updating Elastic Search highways, Indexed {total + smallCahceList.Count} records");
        }
    }
}
