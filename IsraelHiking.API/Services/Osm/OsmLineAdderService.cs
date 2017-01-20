using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using GeoAPI.Geometries;
using IsraelHiking.Common;
using IsraelHiking.DataAccessInterfaces;
using IsraelTransverseMercator;
using NetTopologySuite.Features;
using NetTopologySuite.Geometries;
using OsmSharp.Collections.Tags;
using OsmSharp.Osm;

namespace IsraelHiking.API.Services.Osm
{
    /// <inheritdoc/>
    public class OsmLineAdderService : IOsmLineAdderService
    {
        private class ConnectionWayData
        {
            public string ExsitingNodeId { get; set; }
            public string NewNodeId { get; set; }
            public double DistanceOfNewNodeToClosestWay { get; set; }
            public string TargetWayIdForConnection { get; set; }
            //public int IndexOnExistingWay { get; set; } // might be used to add a node in the middle of an existing highway?
            public int IndexOnNewWay { get; set; }
        }

        private readonly IElasticSearchGateway _elasticSearchGateway;
        private readonly ICoordinatesConverter _coordinatesConverter;
        private readonly IConfigurationProvider _configurationProvider;
        private readonly IOsmGeoJsonPreprocessor _geoJsonPreprocessor;
        private readonly IHttpGatewayFactory _httpGatewayFactory;

        private IOsmGateway _osmGateway;

        /// <summary>
        /// Constructor
        /// </summary>
        /// <param name="elasticSearchGateway"></param>
        /// <param name="coordinatesConverter"></param>
        /// <param name="configurationProvider"></param>
        /// <param name="geoJsonPreprocessor"></param>
        /// <param name="httpGatewayFactory"></param>
        public OsmLineAdderService(IElasticSearchGateway elasticSearchGateway, 
            ICoordinatesConverter coordinatesConverter, 
            IConfigurationProvider configurationProvider, 
            IOsmGeoJsonPreprocessor geoJsonPreprocessor, 
            IHttpGatewayFactory httpGatewayFactory)
        {
            _elasticSearchGateway = elasticSearchGateway;
            _coordinatesConverter = coordinatesConverter;
            _configurationProvider = configurationProvider;
            _geoJsonPreprocessor = geoJsonPreprocessor;
            _httpGatewayFactory = httpGatewayFactory;
        }

        /// <inheritdoc/>
        public async Task Add(LineString line, Dictionary<string, string> tags, TokenAndSecret tokenAndSecret)
        {
            _osmGateway = _httpGatewayFactory.CreateOsmGateway(tokenAndSecret);
            var chagesetId = await _osmGateway.CreateChangeset(CreateCommentFromTags(tags));
            var nodeIds = new List<string>();
            var connectionWays = new List<ConnectionWayData>();
            var highways = await GetHighwaysInArea(line);
            var itmHighways = highways.Select(ToItmLineString).ToList();
            foreach (var lineCoordinate in line.Coordinates)
            {
                var nodeId = await _osmGateway.CreateNode(chagesetId, Node.Create(0, lineCoordinate.Y, lineCoordinate.X));
                nodeIds.Add(nodeId);
                var connectionWay = await GetConnectionWay(lineCoordinate, itmHighways);
                if (connectionWay == null)
                {
                    continue;
                }
                if (nodeIds.Count == 1)
                {
                    // need to connect the first node to an existing way:
                    nodeIds.Insert(0, connectionWay.ExsitingNodeId);
                    continue;
                }
                if (ReferenceEquals(lineCoordinate, line.Coordinates.Last()))
                {
                    nodeIds.Add(connectionWay.ExsitingNodeId);
                    continue;
                }
                connectionWay.NewNodeId = nodeId;
                connectionWay.IndexOnNewWay = line.Coordinates.ToList().IndexOf(lineCoordinate);
                connectionWays.Add(connectionWay);
            }
            var newWayId = await AddWay(nodeIds, tags, chagesetId);
            var newlyAddedWayIds = new List<string> {newWayId};
            connectionWays = FilterConnectionWays(connectionWays);
            foreach (var nodeOnExistingWay in connectionWays)
            {
                newlyAddedWayIds.Add(await AddWay(new[] { nodeOnExistingWay.NewNodeId, nodeOnExistingWay.ExsitingNodeId}, tags, chagesetId));
            }
            await _osmGateway.CloseChangeset(chagesetId);
            await AddWaysToElasticSearch(newlyAddedWayIds);
        }

        /// <summary>
        /// This method filters connections ways that are connecting sequential nodes to the same highway.
        /// </summary>
        /// <param name="connectionWays"></param>
        /// <returns></returns>
        private List<ConnectionWayData> FilterConnectionWays(List<ConnectionWayData> connectionWays)
        {
            var waysGroups = connectionWays.GroupBy(c => c.TargetWayIdForConnection);
            var filteredList = new List<ConnectionWayData>();
            foreach (var waysGroup in waysGroups)
            {
                if (waysGroup.Count() == 1)
                {
                    filteredList.Add(waysGroup.First());
                    continue;
                }
                // Two or more nodes need to be connected to the same way - need to see that they are not sequential
                var next = waysGroup.Last();
                var ways = waysGroup.ToList();
                for (int connectionWayIndex = ways.Count - 2; connectionWayIndex >= 0; connectionWayIndex--)
                {
                    var current = waysGroup.ElementAt(connectionWayIndex);
                    if (next.IndexOnNewWay - 1 != current.IndexOnNewWay)
                    {
                        filteredList.Add(waysGroup.Skip(connectionWayIndex + 1).OrderBy(c => c.DistanceOfNewNodeToClosestWay).First());
                        ways = ways.Take(connectionWayIndex + 1).ToList();
                    }
                    next = current;
                }
                filteredList.Add(ways.OrderBy(c => c.DistanceOfNewNodeToClosestWay).First());
            }
            return filteredList;
        }

        private async Task<List<Feature>> GetHighwaysInArea(LineString line)
        {
            var northEast = _coordinatesConverter.Wgs84ToItm(new LatLon
            {
                Latitude = line.Coordinates.Max(c => c.Y),
                Longitude = line.Coordinates.Max(c => c.X)
            });
            var southWest = _coordinatesConverter.Wgs84ToItm(new LatLon
            {
                Latitude = line.Coordinates.Min(c => c.Y),
                Longitude = line.Coordinates.Min(c => c.X)
            });
            // adding tolerance perimiter to find ways.
            northEast.North += (int) _configurationProvider.ClosestPointTolerance;
            northEast.East += (int)_configurationProvider.ClosestPointTolerance;
            southWest.North -= (int)_configurationProvider.ClosestPointTolerance;
            southWest.East -= (int)_configurationProvider.ClosestPointTolerance;
            var northEastLatLon = _coordinatesConverter.ItmToWgs84(northEast);
            var southWestLatLon = _coordinatesConverter.ItmToWgs84(southWest);

            var highways = await _elasticSearchGateway.GetHighways(new LatLng
            {
                lat = northEastLatLon.Latitude,
                lng = northEastLatLon.Longitude
            }, new LatLng
            {
                lat = southWestLatLon.Latitude,
                lng = southWestLatLon.Longitude
            });
            return highways.ToList();
        }

        private async Task<ConnectionWayData> GetConnectionWay(Coordinate coordinate, List<LineString> itmHighways)
        {
            var northEast = _coordinatesConverter.Wgs84ToItm(new LatLon {Latitude = coordinate.Y, Longitude = coordinate.X});
            var point = new Point(northEast.East, northEast.North);
            if (!itmHighways.Any())
            {
                return null;
            }
            var closestHighway = itmHighways.Where(l => l.Distance(point) < _configurationProvider.ClosestPointTolerance * 2)
                .OrderBy(l => l.Distance(point))
                .FirstOrDefault();
            if (closestHighway == null)
            {
                return null;
            }
            var closestWay = await _osmGateway.GetCompleteWay(closestHighway.UserData.ToString());
            var closestPointInWay = closestHighway.Coordinates.OrderBy(c => c.Distance(point.Coordinate)).First();
            var indexOnWay = closestHighway.Coordinates.ToList().IndexOf(closestPointInWay);
            var existingNodeId = closestWay.Nodes[indexOnWay].Id.ToString();
            return new ConnectionWayData
            {
                TargetWayIdForConnection = closestWay.Id.ToString(),
                ExsitingNodeId = existingNodeId,
                DistanceOfNewNodeToClosestWay = closestHighway.Distance(point),
                //IndexOnExistingWay = indexOnWay
            };
        }

        private LineString ToItmLineString(Feature feature)
        {
            var itmCoordinates = feature.Geometry.Coordinates.Select(coordinate =>
            {
                var northEast = _coordinatesConverter.Wgs84ToItm(new LatLon { Longitude = coordinate.X, Latitude = coordinate.Y });
                return new Coordinate(northEast.East, northEast.North);
            }).ToArray();
            return new LineString(itmCoordinates) { UserData = feature.Attributes["osm_id"]};
        }

        private async Task<string> AddWay(IEnumerable<string> nodeIds, Dictionary<string, string> tags, string chagesetId)
        {
            var way = Way.Create(0, nodeIds.Select(long.Parse).ToArray());
            way.Tags = new TagsCollection(tags)
            {
                {"note", "Added by IHM algorithm - fixing maybe needed"},
                {"source", "GPS" }
            };
            return await _osmGateway.CreateWay(chagesetId, way);
        }

        private async Task AddWaysToElasticSearch(List<string> wayIds)
        {
            var tasksList = wayIds.Select(wayId => _osmGateway.GetCompleteWay(wayId)).ToList();
            var newlyaddedWays = await Task.WhenAll(tasksList);
            var newlyHighwaysFeatures = _geoJsonPreprocessor.Preprocess(newlyaddedWays.ToList());
            await _elasticSearchGateway.UpdateHighwaysData(newlyHighwaysFeatures);
        }

        private string CreateCommentFromTags(Dictionary<string, string> tags)
        {
            var colour = string.Empty;
            if (tags.ContainsKey("colour"))
            {
                colour = tags["colour"] + " ";
            }
            var highway = "way";
            if (tags.ContainsKey("highway"))
            {
                highway = tags["highway"];
            }
            return $"Added a missing {colour}{highway} from a GPS trace using IsraelHiking.osm.org.il";
        }
    }
}
