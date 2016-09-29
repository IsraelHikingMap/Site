using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Threading.Tasks;
using IsraelHiking.API.Converters;
using IsraelHiking.DataAccessInterfaces;
using NetTopologySuite.Features;
using NetTopologySuite.Geometries;
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
        private readonly IOsmGeoJsonConverter _osmGeoJsonConverter;
        private readonly IOsmRepository _osmRepository;
        private string _serverPath;

        public OsmDataService(IGraphHopperHelper graphHopperHelper,
            IRemoteFileFetcherGateway remoteFileFetcherGateway,
            IFileSystemHelper fileSystemHelper,
            IElasticSearchGateway elasticSearchGateway,
            INssmHelper elasticSearchHelper,
            IOsmRepository osmRepository,
            IOsmGeoJsonConverter osmGeoJsonConverter,
            ILogger logger)
        {
            _graphHopperHelper = graphHopperHelper;
            _remoteFileFetcherGateway = remoteFileFetcherGateway;
            _fileSystemHelper = fileSystemHelper;
            _elasticSearchGateway = elasticSearchGateway;
            _elasticSearchHelper = elasticSearchHelper;
            _osmRepository = osmRepository;
            _osmGeoJsonConverter = osmGeoJsonConverter;
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
            var geoJsonDictionary = ConvertDictionary(namesDictionary);
            var containers = geoJsonDictionary.Values.SelectMany(v => v).Where(f =>
                !(f.Geometry is MultiLineString) &&
                !(f.Geometry is LineString) &&
                !(f.Geometry is MultiPoint) &&
                !(f.Geometry is Point)).ToList();
            var smallCahceList = new List<Feature>(PAGE_SIZE);
            int total = 0;
            _elasticSearchGateway.Initialize(deleteIndex: true);
            foreach (var name in geoJsonDictionary.Keys)
            {
                smallCahceList.AddRange(ManipulateOsmDataToGeoJson(name, geoJsonDictionary, containers));
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
            }
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

        private Dictionary<string, List<Feature>> ConvertDictionary(Dictionary<string, List<ICompleteOsmGeo>> namesDictionary)
        {
            _logger.Info("Converting OSM data to GeoJson, total distict names: " + namesDictionary.Keys.Count);
            var geoJsonDictionary = new Dictionary<string, List<Feature>>();
            for (int index = namesDictionary.Count - 1; index >= 0; index--)
            {
                var pair = namesDictionary.ElementAt(index);
                var osmList = MergeElements(pair.Value)
                        .Select(e => _osmGeoJsonConverter.ToGeoJson(e))
                        .Where(f => f != null)
                        .ToList();
                if (osmList.Count > 0)
                {
                    geoJsonDictionary[pair.Key] = osmList;
                }
                namesDictionary.Remove(pair.Key);
            }
            _logger.Info("Finished converting OSM data to GeoJson");
            return geoJsonDictionary;
        }

        private IEnumerable<Feature> ManipulateOsmDataToGeoJson(string name, Dictionary<string, List<Feature>> geoJsonDictionary, List<Feature> containers)
        {
            var list = geoJsonDictionary[name];
            MergePlacesPoints(list);
            foreach (var feature in list)
            {
                AddAddressField(feature, containers);
                var propertiesExtraData = GeoJsonFeatureHelper.FindPropertiesData(feature);
                feature.Attributes.AddAttribute(SEARCH_FACTOR, propertiesExtraData?.SearchFactor ?? PropertiesData.DefaultSearchFactor);
                feature.Attributes.AddAttribute(ICON, propertiesExtraData?.Icon ?? string.Empty);
            }
            return list;
        }

        private void MergePlacesPoints(List<Feature> list)
        {
            var placesPoints = list.Where(f => f.Geometry is Point && f.Attributes.GetNames().Contains(PLACE)).ToList();
            var nonPlacesPoints = list.Except(placesPoints).ToList();
            foreach (var feature in nonPlacesPoints)
            {
                var placePoint = placesPoints.FirstOrDefault(p => p.Geometry.Within(feature.Geometry));
                if (placePoint == null)
                {
                    continue;
                }
                feature.Attributes.AddAttribute("lat", placePoint.Geometry.Coordinate.Y);
                feature.Attributes.AddAttribute("lng", placePoint.Geometry.Coordinate.X);
                foreach (var placePointAttributeName in placePoint.Attributes.GetNames())
                {
                    if (feature.Attributes.GetNames().Contains(placePointAttributeName) == false)
                    {
                        feature.Attributes.AddAttribute(placePointAttributeName, placePoint.Attributes[placePointAttributeName]);
                    }
                }
                list.Remove(placePoint);
                placesPoints.Remove(placePoint);
            }
        }

        private void AddAddressField(Feature feature, List<Feature> containers)
        {
            if (!(feature.Geometry is Point) && !(feature.Geometry is LineString))
            {
                return;
            }
            Feature invalidFeature = null;
            var containingGeoJson = containers.FirstOrDefault(f =>
            {
                try
                {
                    return f != feature && f.Geometry.Contains(feature.Geometry);
                }
                catch (Exception)
                {
                    _logger.Debug($"Issue with contains test for: {f.Geometry.GeometryType}_{f.Attributes["osm_id"]}");
                    invalidFeature = f;
                    return false;
                }
            });
            if (invalidFeature != null)
            {
                containers.Remove(invalidFeature);
            }
            if (containingGeoJson == null)
            {
                return;
            }
            foreach (var attributeName in containingGeoJson.Attributes.GetNames().Where(n => n.StartsWith("name")))
            {
                var addressName = attributeName.Replace("name", "address");
                feature.Attributes.AddAttribute(addressName, containingGeoJson.Attributes[attributeName]);
            }
        }
    }
}
