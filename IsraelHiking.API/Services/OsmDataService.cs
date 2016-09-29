using System;
using System.Collections.Generic;
using System.IO;
using System.Threading.Tasks;
using IsraelHiking.DataAccessInterfaces;
using NetTopologySuite.Features;

namespace IsraelHiking.API.Services
{
    public class OsmDataService : IOsmDataService
    {
        private const string PBF_FILE_NAME = "israel-and-palestine-latest.osm.pbf";
        private const int PAGE_SIZE = 10000;

        private readonly ILogger _logger;
        private readonly IRemoteFileFetcherGateway _remoteFileFetcherGateway;
        private readonly IGraphHopperHelper _graphHopperHelper;
        private readonly INssmHelper _elasticSearchHelper;
        private readonly IFileSystemHelper _fileSystemHelper;
        private readonly IElasticSearchGateway _elasticSearchGateway;
        private readonly IOsmGeoJsonPreprocessor _osmGeoJsonPreprocessor;
        private readonly IOsmRepository _osmRepository;
        private string _serverPath;

        public OsmDataService(IGraphHopperHelper graphHopperHelper,
            IRemoteFileFetcherGateway remoteFileFetcherGateway,
            IFileSystemHelper fileSystemHelper,
            IElasticSearchGateway elasticSearchGateway,
            INssmHelper elasticSearchHelper,
            IOsmRepository osmRepository,
            IOsmGeoJsonPreprocessor osmGeoJsonPreprocessor,
            ILogger logger)
        {
            _graphHopperHelper = graphHopperHelper;
            _remoteFileFetcherGateway = remoteFileFetcherGateway;
            _fileSystemHelper = fileSystemHelper;
            _elasticSearchGateway = elasticSearchGateway;
            _elasticSearchHelper = elasticSearchHelper;
            _osmRepository = osmRepository;
            _logger = logger;
            _osmGeoJsonPreprocessor = osmGeoJsonPreprocessor;
        }

        /// <summary>
        /// Initializes the service.
        /// </summary>
        /// <param name="serverPath">Bin folder where all dlls are.</param>
        public async Task Initialize(string serverPath)
        {
            _logger.Info("Initializing OSM data service with server path: " + serverPath);
            _serverPath = serverPath;
            await _graphHopperHelper.Initialize(serverPath);
            await _elasticSearchHelper.Initialize(serverPath);
            _logger.Info("Finished initializing OSM data service with server path: " + serverPath);
        }

        public async Task UpdateData(OsmDataServiceOperations operations)
        {
            try
            {
                if (operations == OsmDataServiceOperations.None)
                {
                    _logger.Warn("No operations are requested, doing nothing...");
                    return;
                }
                _logger.Info("Updating OSM data");
                var osmFilePath = Path.Combine(_serverPath, PBF_FILE_NAME);
                if ((operations & OsmDataServiceOperations.GetOsmFile) != 0)
                {
                    await FetchOsmFile(osmFilePath);
                }
                if (_fileSystemHelper.Exists(osmFilePath) == false)
                {
                    _logger.Error(osmFilePath + " File is missing. Fatal error - exiting.");
                    return;
                }
                if ((operations & OsmDataServiceOperations.UpdateElasticSearch) != 0)
                {
                    await UpdateElasticSearchFromFile(osmFilePath);
                }
                if ((operations & OsmDataServiceOperations.UpdateGraphHopper) != 0)
                {
                    await _graphHopperHelper.UpdateData(osmFilePath);
                }
                _logger.Info("Finished Updating OSM data");
            }
            catch (Exception ex)
            {
                _logger.Error(ex.ToString());
            }
        }

        private async Task FetchOsmFile(string osmFilePath)
        {
            var address = "http://download.geofabrik.de/asia/" + PBF_FILE_NAME;
            var length = await _remoteFileFetcherGateway.GetFileSize(address);
            if (_fileSystemHelper.GetFileSize(osmFilePath) != length)
            {
                var response = await _remoteFileFetcherGateway.GetFileContent(address);
                _fileSystemHelper.WriteAllBytes(osmFilePath, response.Content);
            }
        }

        private async Task UpdateElasticSearchFromFile(string osmFilePath)
        {
            _logger.Info("Updating Elastic Search OSM data");
            var osmNamesDictionary = await _osmRepository.GetElementsWithName(osmFilePath);
            var geoJsonNamesDictionary = _osmGeoJsonPreprocessor.Preprocess(osmNamesDictionary);
            _elasticSearchGateway.Initialize(deleteIndex: true);
            UpdateElesticSearchDataUsingPaging(geoJsonNamesDictionary);
        }

        private void UpdateElesticSearchDataUsingPaging(Dictionary<string, List<Feature>> geoJsonNamesDictionary)
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
                _logger.Info($"Indexing {total} records");
                _elasticSearchGateway.UpdateData(smallCahceList).Wait();
                smallCahceList.Clear();
            }
            _elasticSearchGateway.UpdateData(smallCahceList).Wait();
            _logger.Info($"Finished updating Elastic Search, Indexed {total + smallCahceList.Count} records");
        }
    }
}
