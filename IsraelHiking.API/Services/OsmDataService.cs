using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Threading.Tasks;
using GeoJSON.Net.Feature;
using IsraelHiking.API.Converters;
using IsraelHiking.DataAccess.ElasticSearch;
using IsraelHiking.DataAccessInterfaces;
using OsmSharp.Osm;
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
        private const string PLACE = "place";
        private const string NAME = "name";

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
                var smallCahceList = new List<Feature>(PAGE_SIZE);
                int total = 0;
                var namesDictionary = completeSource
                    .Where(o => string.IsNullOrWhiteSpace(GetName(o)) == false)
                    .GroupBy(GetName)
                    .ToDictionary(g => g.Key, g => g.ToList());
                foreach (var name in namesDictionary.Keys)
                {
                    var list = MergeElements(namesDictionary[name]).Select(e => converter.ToGeoJson(e)).Where(f => f != null).ToList();
                    list.ForEach(feature =>
                    {
                        var propertiesExtraData = GeoJsonFeatureHelper.FindPropertiesData(feature);
                        feature.Properties["sort_order"] = propertiesExtraData?.SortOrder ?? 0;
                        feature.Properties["icon"] = propertiesExtraData?.Icon ?? string.Empty;
                    });
                    smallCahceList.AddRange(list);
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

        private string GetName(ICompleteOsmGeo osm)
        {
            if (osm.Tags.ContainsKey(NAME))
            {
                return osm.Tags[NAME];
            }
            foreach (var tag in osm.Tags)
            {
                if (tag.Key.Contains(NAME))
                {
                    return tag.Value;
                }
            }
            return string.Empty;
        }

        private List<ICompleteOsmGeo> MergeElements(List<ICompleteOsmGeo> elements)
        {
            if (elements.Count == 1)
            {
                return elements;
            }
            var nodes = elements.OfType<Node>().ToList();
            var ways = elements.OfType<CompleteWay>().ToList();
            var relations = elements.OfType<CompleteRelation>().ToList();
            if (nodes.Count == elements.Count || ways.Count == elements.Count || relations.Count == elements.Count)
            {
                return elements;
            }
            foreach (var way in ways.Where(w => w.Tags.ContainsKey(PLACE)))
            {
                MergePlaceNode(nodes, way);
            }
            foreach (var relation in relations)
            {
                foreach (var way in OsmGeoJsonConverter.GetAllWays(relation))
                {
                    var wayToRemove = ways.FirstOrDefault(w => w.Id == way.Id);
                    if (wayToRemove != null)
                    {
                        MergeTags(way, relation);
                        ways.Remove(wayToRemove);
                    }
                }
                if (relation.Tags.ContainsKey(PLACE))
                {
                    MergePlaceNode(nodes, relation);
                }
            }

            var mergedElements = new List<ICompleteOsmGeo>();
            mergedElements.AddRange(nodes);
            mergedElements.AddRange(ways);
            mergedElements.AddRange(relations);
            return mergedElements;
        }

        private void MergePlaceNode(List<Node> nodes, ICompleteOsmGeo element)
        {
            var node = nodes.FirstOrDefault(n => n.Tags.ContainsKey(PLACE));
            if (node == null)
            {
                return;
            }
            element.Tags.Add("lat", node.Latitude.ToString());
            element.Tags.Add("lng", node.Longitude.ToString());
            MergeTags(node, element);
            nodes.Remove(node);
        }

        private void MergeTags(ICompleteOsmGeo fromItem, ICompleteOsmGeo toItem)
        {
            foreach (var tag in fromItem.Tags)
            {
                toItem.Tags.AddOrReplace(tag);
            }
        }
    }
}
