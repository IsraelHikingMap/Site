using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Threading.Tasks;
using IsraelHiking.API.Converters;
using IsraelHiking.DataAccessInterfaces;
using NetTopologySuite.Features;
using OsmSharp.Osm;

namespace IsraelHiking.API.Services
{
    public class OsmDataService : IOsmDataService
    {
        private const string PBF_FILE_NAME = "israel-and-palestine-latest.osm.pbf";
        private const int PAGE_SIZE = 10000;
        private const string PLACE = "place";
        private const string ICON = "icon";
        private const string SEARCH_FACTOR = "search_factor";

        private readonly ILogger _logger;
        private readonly IRemoteFileFetcherGateway _remoteFileFetcherGateway;
        private readonly IGraphHopperHelper _graphHopperHelper;
        private readonly INssmHelper _elasticSearchHelper;
        private readonly IFileSystemHelper _fileSystemHelper;
        private readonly IElasticSearchGateway _elasticSearchGateway;
        private readonly IOsmRepository _osmRepository;
        private string _serverPath;

        public OsmDataService(IGraphHopperHelper graphHopperHelper,
            IRemoteFileFetcherGateway remoteFileFetcherGateway,
            IFileSystemHelper fileSystemHelper,
            IElasticSearchGateway elasticSearchGateway,
            INssmHelper elasticSearchHelper,
            IOsmRepository osmRepository,
            ILogger logger)
        {
            _graphHopperHelper = graphHopperHelper;
            _remoteFileFetcherGateway = remoteFileFetcherGateway;
            _fileSystemHelper = fileSystemHelper;
            _elasticSearchGateway = elasticSearchGateway;
            _elasticSearchHelper = elasticSearchHelper;
            _osmRepository = osmRepository;
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
            var namesDictionary = await _osmRepository.GetElementsWithName(osmFilePath);
            var converter = new OsmGeoJsonConverter();
            var smallCahceList = new List<Feature>(PAGE_SIZE);
            int total = 0;
            _elasticSearchGateway.Initialize(deleteIndex: true);
            foreach (var name in namesDictionary.Keys)
            {
                var list = MergeElements(namesDictionary[name]).Select(e => converter.ToGeoJson(e)).Where(f => f != null).ToList();
                list.ForEach(feature =>
                {
                    var propertiesExtraData = GeoJsonFeatureHelper.FindPropertiesData(feature);
                    feature.Attributes.AddAttribute(SEARCH_FACTOR, propertiesExtraData?.SearchFactor ?? PropertiesData.DefaultSearchFactor);
                    feature.Attributes.AddAttribute(ICON, propertiesExtraData?.Icon ?? string.Empty);
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

        private IEnumerable<ICompleteOsmGeo> MergeElements(IReadOnlyCollection<ICompleteOsmGeo> elements)
        {
            if (elements.Count == 1)
            {
                return elements;
            }
            var nodes = elements.OfType<Node>().ToList();
            var ways = elements.OfType<CompleteWay>().ToList();
            var relations = elements.OfType<CompleteRelation>().ToList();
            if (nodes.Count == elements.Count || relations.Count == elements.Count)
            {
                return elements;
            }
            foreach (var way in ways.Where(w => w.Tags.ContainsKey(PLACE)))
            {
                MergePlaceNode(nodes, way);
            }
            MergeWaysInRelations(relations, ways, nodes);
            ways = MergeWays(ways);
            var mergedElements = new List<ICompleteOsmGeo>();
            mergedElements.AddRange(nodes);
            mergedElements.AddRange(ways);
            mergedElements.AddRange(relations);
            return mergedElements;
        }

        private void MergeWaysInRelations(IEnumerable<CompleteRelation> relations, ICollection<CompleteWay> ways, ICollection<Node> nodes)
        {
            foreach (var relation in relations)
            {
                foreach (var way in OsmGeoJsonConverter.GetAllWays(relation))
                {
                    var wayToRemove = ways.FirstOrDefault(w => w.Id == way.Id);
                    if (wayToRemove == null)
                    {
                        continue;
                    }
                    MergeTags(way, relation);
                    ways.Remove(wayToRemove);
                }
                if (relation.Tags.ContainsKey(PLACE))
                {
                    MergePlaceNode(nodes, relation);
                }
            }
        }

        private void MergePlaceNode(ICollection<Node> nodes, ICompleteOsmGeo element)
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

        /// <summary>
        /// This method create a new list of ways based on the given list. 
        /// The merge is done by looking into the ways' nodes and combine ways which start or end with the same node. 
        /// </summary>
        /// <param name="ways">The ways to merge</param>
        /// <returns>The merged ways</returns>
        private List<CompleteWay> MergeWays(List<CompleteWay> ways)
        {
            if (ways.Any() == false)
            {
                return new List<CompleteWay>();
            }
            var mergedWays = new List<CompleteWay> { ways.First() };
            var waysToMerge = new List<CompleteWay>(ways.Skip(1));
            while (waysToMerge.Any())
            {
                var foundAWayToMergeTo = false;
                for (var index = waysToMerge.Count - 1; index >= 0; index--)
                {
                    var wayToMerge = waysToMerge[index];
                    var wayToMergeTo =
                        mergedWays.FirstOrDefault(
                            mw =>
                                mw.Nodes.Last().Id == wayToMerge.Nodes.First().Id ||
                                mw.Nodes.First().Id == wayToMerge.Nodes.Last().Id ||
                                mw.Nodes.First().Id == wayToMerge.Nodes.First().Id ||
                                mw.Nodes.Last().Id == wayToMerge.Nodes.Last().Id);
                    if (wayToMergeTo == null)
                    {
                        continue;
                    }
                    if (wayToMerge.Nodes.First().Id == wayToMergeTo.Nodes.First().Id ||
                        wayToMerge.Nodes.Last().Id == wayToMergeTo.Nodes.Last().Id)
                    {
                        wayToMerge.Nodes.Reverse();
                    }
                    var nodes = wayToMerge.Nodes;
                    if (nodes.Last().Id == wayToMergeTo.Nodes.First().Id)
                    {
                        nodes.Remove(nodes.Last());
                        wayToMergeTo.Nodes.InsertRange(0, nodes);
                    }
                    else if (nodes.First().Id == wayToMergeTo.Nodes.Last().Id)
                    {
                        nodes.Remove(nodes.First());
                        wayToMergeTo.Nodes.AddRange(nodes);
                    }

                    MergeTags(wayToMerge, wayToMergeTo);
                    waysToMerge.Remove(wayToMerge);
                    foundAWayToMergeTo = true;
                }

                if (foundAWayToMergeTo)
                {
                    continue;
                }

                mergedWays.Add(waysToMerge.First());
                waysToMerge.RemoveAt(0);
            }
            return mergedWays;
        }
    }
}
