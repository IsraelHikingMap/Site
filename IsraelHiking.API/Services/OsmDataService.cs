using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Threading.Tasks;
using GeoJSON.Net.Feature;
using IsraelHiking.API.Converters;
using IsraelHiking.DataAccess.ElasticSearch;
using IsraelHiking.DataAccessInterfaces;
using OsmSharp.Osm.PBF.Streams;
using OsmSharp.Osm.Streams.Complete;

namespace IsraelHiking.API.Services
{
    public class OsmDataService
    {
        [Flags]
        public enum Operations
        {
            None = 0,
            GetOsmFile = 1,
            UpdateElasticSearch = 2,
            UpdateGraphHopper = 4,
            All = GetOsmFile | UpdateElasticSearch | UpdateGraphHopper
        }

        private const string PBF_FILE_NAME = "israel-and-palestine-latest.osm.pbf";
        private const int PAGE_SIZE = 10000;

        private readonly ILogger _logger;
        private readonly IRemoteFileFetcherGateway _remoteFileFetcherGateway;
        private readonly IGraphHopperHelper _graphHopperHelper;
        private readonly INssmHelper _elasticSearchHelper;
        private readonly IFileSystemHelper _fileSystemHelper;
        private readonly IElasticSearchGateway _elasticSearchGateway;
        private string _serverPath;

        public OsmDataService(IGraphHopperHelper graphHopperHelper,
            IRemoteFileFetcherGateway remoteFileFetcherGateway,
            IFileSystemHelper fileSystemHelper,
            IElasticSearchGateway elasticSearchGateway,
            INssmHelper elasticSearchHelper,
            ILogger logger
            )
        {
            _graphHopperHelper = graphHopperHelper;
            _remoteFileFetcherGateway = remoteFileFetcherGateway;
            _fileSystemHelper = fileSystemHelper;
            _elasticSearchGateway = elasticSearchGateway;
            _elasticSearchHelper = elasticSearchHelper;
            _logger = logger;
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
            _elasticSearchGateway.Initialize();
            _logger.Info("Finished initializing OSM data service with server path: " + serverPath);
        }

        public async Task UpdateData(Operations operations)
        {
            try
            {
                if (operations == Operations.None)
                {
                    _logger.Warn("No operations are requested, doing nothing...");
                    return;
                }
                _logger.Info("Updating OSM data");
                var osmFilePath = Path.Combine(_serverPath, PBF_FILE_NAME);
                if ((operations & Operations.GetOsmFile) != 0)
                {
                    await FetchOsmFile(osmFilePath);
                }
                if (_fileSystemHelper.Exists(osmFilePath) == false)
                {
                    _logger.Error(osmFilePath + " File is missing. Fatal error - exiting.");
                    return;
                }
                if ((operations & Operations.UpdateElasticSearch) != 0)
                {
                    await UpdateElasticSearchFromFile(osmFilePath);
                }
                if ((operations & Operations.UpdateGraphHopper) != 0)
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
            using (var stream = _fileSystemHelper.FileOpenRead(osmFilePath))
            {
                var source = new PBFOsmStreamSource(stream);
                await _elasticSearchGateway.DeleteAll();
                var completeSource = new OsmSimpleCompleteStreamSource(source);
                var converter = new OsmGeoJsonConverter();
                var list = new List<Feature>(PAGE_SIZE);
                int page = 0;
                foreach (var completeOsmGeo in completeSource)
                {
                    var geoJson = converter.ToGeoJson(completeOsmGeo);
                    if (geoJson?.Properties == null || !geoJson.Properties.Keys.Any(k => k.Contains("name")))
                    {
                        continue;
                    }
                    list.Add(geoJson);
                    if (list.Count != PAGE_SIZE)
                    {
                        continue;
                    }
                    page++;
                    _logger.Info($"Indexing {PAGE_SIZE * page} records");
                    _elasticSearchGateway.UpdateData(list).Wait();
                    list.Clear();
                }
                _elasticSearchGateway.UpdateData(list).Wait();
                _logger.Info($"Finished updating Elastic Search, Indexed {PAGE_SIZE * page + list.Count} records");
            }
        }
    }
}
