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
            var changesetId = await _osmGateway.CreateChangeset(CreateCommentFromTags(tags));
            try
            {
                var nodeIds = new List<string>();
                var highways = await GetHighwaysInArea(line);
                var itmHighways = highways.Select(ToItmLineString).ToList();
                var waysToUpdateIds = new List<string>();
                for (int coordinateIndex = 0; coordinateIndex < line.Coordinates.Length; coordinateIndex++)
                {
                    var coordinate = line.Coordinates[coordinateIndex];
                    if (coordinateIndex > 0)
                    {
                        var previousCoordinate = line.Coordinates[coordinateIndex - 1];
                        await AddIntersectingNodes(previousCoordinate, coordinate, nodeIds, itmHighways);
                    }
                    var closestCompleteWay = await GetClosetHighway(coordinate, itmHighways);
                    if (closestCompleteWay == null)
                    {
                        // no close highways, adding a new node
                        nodeIds.Add(await _osmGateway.CreateNode(changesetId, Node.Create(0, coordinate.Y, coordinate.X)));
                        continue;
                    }
                    var itmPoint = GetItmCoordinate(coordinate);
                    var closestItmHighway = itmHighways.First(hw => hw.GetOsmId() == closestCompleteWay.Id.ToString());
                    var closestItmPointInWay = closestItmHighway.Coordinates.OrderBy(c => c.Distance(itmPoint.Coordinate)).First();
                    var indexOnWay = closestItmHighway.Coordinates.ToList().IndexOf(closestItmPointInWay);
                    if (closestItmPointInWay.Distance(itmPoint.Coordinate) <= _configurationProvider.DistanceToExisitngLineMergeThreshold)
                    {
                        // close hihgway, adding the node id from that highway
                        nodeIds.Add(closestCompleteWay.Nodes[indexOnWay].Id.ToString());
                        continue;
                    }
                    // need to add a new node to existing highway
                    var newNodeId = await _osmGateway.CreateNode(changesetId, Node.Create(0, coordinate.Y, coordinate.X));
                    nodeIds.Add(newNodeId);
                    var simpleWay = AddNewNodeToExistingWay(newNodeId, closestCompleteWay, closestItmHighway, indexOnWay, itmPoint);
                    await _osmGateway.UpdateWay(changesetId, simpleWay);
                    waysToUpdateIds.Add(simpleWay.Id.ToString());
                }
                var newWayId = await AddWayToOsm(nodeIds, tags, changesetId);
                waysToUpdateIds.Add(newWayId);
                await AddWaysToElasticSearch(waysToUpdateIds);
            }
            finally 
            {
                await _osmGateway.CloseChangeset(changesetId);
            }
        }

        private async Task AddIntersectingNodes(Coordinate previousCoordinate, Coordinate coordinate, List<string> nodeIds, List<LineString> itmHighways)
        {
            var lineSegment = new LineString(new [] { GetItmCoordinate(previousCoordinate).Coordinate, GetItmCoordinate(coordinate).Coordinate});
            var closeLines = itmHighways.Where(hw => hw.Distance(lineSegment) <= _configurationProvider.DistanceToExisitngLineMergeThreshold);
            foreach (var closeLine in closeLines)
            {
                var closestPointInExistingLine = closeLine.Coordinates.Select(c => new Point(c)).OrderBy(p => p.Distance(lineSegment)).First();
                if (closestPointInExistingLine.Distance(lineSegment) > _configurationProvider.DistanceToExisitngLineMergeThreshold)
                {
                    continue;
                }
                var indexInLine = closeLine.Coordinates.ToList().IndexOf(closestPointInExistingLine.Coordinate);
                var completeWay = await _osmGateway.GetCompleteWay(closeLine.GetOsmId());
                nodeIds.Add(completeWay.Nodes[indexInLine].Id.ToString());
            }
        }

        private Way AddNewNodeToExistingWay(string nodeId, CompleteWay closestCompleteWay, LineString closestItmHighway, int indexOnWay, Point itmPoint)
        {
            var indexToInsert = indexOnWay;
            if (indexOnWay != closestItmHighway.Coordinates.Length - 1)
            {
                var postItmLine = new LineString(new [] { closestItmHighway.Coordinates[indexOnWay], closestItmHighway.Coordinates[indexOnWay + 1] });
                if (postItmLine.Distance(itmPoint) <= _configurationProvider.DistanceToExisitngLineMergeThreshold)
                {
                    indexToInsert = indexOnWay + 1;
                }
            }
            var simpleWay = (Way)closestCompleteWay.ToSimple();
            simpleWay.Nodes.Insert(indexToInsert, long.Parse(nodeId));
            return simpleWay;
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

        private Point GetItmCoordinate(Coordinate coordinate)
        {
            var northEast = _coordinatesConverter.Wgs84ToItm(new LatLon { Latitude = coordinate.Y, Longitude = coordinate.X });
            return new Point(northEast.East, northEast.North);
        }

        private async Task<CompleteWay> GetClosetHighway(Coordinate coordinate, List<LineString> itmHighways)
        {
            var point = GetItmCoordinate(coordinate);
            if (!itmHighways.Any())
            {
                return null;
            }
            var closestHighway = itmHighways.Where(l => l.Distance(point) <= _configurationProvider.DistanceToExisitngLineMergeThreshold)
                .OrderBy(l => l.Distance(point))
                .FirstOrDefault();
            if (closestHighway == null)
            {
                return null;
            }
            return await _osmGateway.GetCompleteWay(closestHighway.GetOsmId());
        }

        private LineString ToItmLineString(Feature feature)
        {
            var itmCoordinates = feature.Geometry.Coordinates.Select(coordinate =>
            {
                var northEast = _coordinatesConverter.Wgs84ToItm(new LatLon { Longitude = coordinate.X, Latitude = coordinate.Y });
                return new Coordinate(northEast.East, northEast.North);
            }).ToArray();
            var lineString = new LineString(itmCoordinates);
            lineString.SetOsmId(feature.Attributes["osm_id"].ToString());
            return lineString;
        }

        private async Task<string> AddWayToOsm(IEnumerable<string> nodeIds, Dictionary<string, string> tags, string chagesetId)
        {
            var way = Way.Create(0, nodeIds.Select(long.Parse).ToArray());
            way.Tags = new TagsCollection(tags)
            {
                {"note", "Added by IHM algorithm - fixing maybe needed"}
            };
            if (way.Tags.ContainsKey("source") == false)
            {
                way.Tags.Add("source", "GPS");
            }
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
