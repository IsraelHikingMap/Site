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
    /// <summary>
    /// This class is responsible of adding a given line to OSM
    /// </summary>
    public class OsmLineAdderService : IOsmLineAdderService
    {
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

        /// <summary>
        /// Use this method to add a line to OSM, this algorithm tries to add the line to existing lines in OSM
        /// </summary>
        /// <param name="line">The line to add</param>
        /// <param name="tags">The tags to add to the line</param>
        /// <param name="tokenAndSecret">Used as OSM credentials</param>
        /// <returns></returns>
        public async Task Add(LineString line, Dictionary<string, string> tags, TokenAndSecret tokenAndSecret)
        {
            _osmGateway = _httpGatewayFactory.CreateOsmGateway(tokenAndSecret);
            var chagesetId = await _osmGateway.CreateChangeset(CreateCommentFromTags(tags));
            var nodeIds = new List<string>();
            var nodesIdsThatNeedsToBeConnected = new Dictionary<string, string>();
            var highways = await GetHighwaysInArea(line);
            var itmHighways = highways.Select(ToItmLineString).ToList();
            foreach (var lineCoordinate in line.Coordinates)
            {
                var nodeId = await _osmGateway.CreateNode(chagesetId, Node.Create(0, lineCoordinate.Y, lineCoordinate.X));
                nodeIds.Add(nodeId);
                var closestExistingNodeId = await GetClosestExsistingNodeId(lineCoordinate, itmHighways);
                if (closestExistingNodeId == null)
                {
                    continue;
                }
                nodesIdsThatNeedsToBeConnected[nodeId] = closestExistingNodeId;
            }

            var newlyAddedWayIds = new List<string>();
            foreach (var nodeIdOnNewWay in nodesIdsThatNeedsToBeConnected.Keys)
            {
                var nodeIdOnExistingWay = nodesIdsThatNeedsToBeConnected[nodeIdOnNewWay];
                if (nodeIdOnNewWay == nodeIds.First())
                {
                    nodeIds.Insert(0, nodeIdOnExistingWay);
                    continue;
                }
                if (nodeIdOnNewWay == nodeIds.Last())
                {
                    nodeIds.Add(nodeIdOnExistingWay);
                    continue;
                }
                newlyAddedWayIds.Add(await AddWay(new[] {nodeIdOnNewWay, nodeIdOnExistingWay}, tags, chagesetId));
            }
            newlyAddedWayIds.Add(await AddWay(nodeIds, tags, chagesetId));
            await _osmGateway.CloseChangeset(chagesetId);
            await AddWaysToElasticSearch(newlyAddedWayIds);
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

        private async Task<string> GetClosestExsistingNodeId(Coordinate coordinate, List<LineString> lineStrings)
        {
            var northEast = _coordinatesConverter.Wgs84ToItm(new LatLon {Latitude = coordinate.Y, Longitude = coordinate.X});
            var point = new Point(northEast.East, northEast.North);
            if (!lineStrings.Any())
            {
                return null;
            }
            var closestLine = lineStrings.Where(l => l.Distance(point) < _configurationProvider.ClosestPointTolerance)
                .OrderBy(l => l.Distance(point))
                .FirstOrDefault();
            if (closestLine == null)
            {
                return null;
            }
            var closestWay = await _osmGateway.GetCompleteWay(closestLine.UserData.ToString());
            var closestPointInWay = closestLine.Coordinates.OrderBy(c => c.Distance(point.Coordinate)).First();
            return closestWay.Nodes[closestLine.Coordinates.ToList().IndexOf(closestPointInWay)].Id.ToString();
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
