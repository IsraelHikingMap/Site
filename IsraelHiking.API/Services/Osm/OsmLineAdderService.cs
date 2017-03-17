using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using GeoAPI.CoordinateSystems.Transformations;
using GeoAPI.Geometries;
using IsraelHiking.API.Executors;
using IsraelHiking.Common;
using IsraelHiking.DataAccessInterfaces;
using NetTopologySuite.Features;
using NetTopologySuite.Geometries;
using OsmSharp;
using OsmSharp.Complete;
using OsmSharp.Tags;
using Microsoft.Extensions.Options;

namespace IsraelHiking.API.Services.Osm
{
    /// <inheritdoc/>
    public class OsmLineAdderService : IOsmLineAdderService
    {
        private readonly IElasticSearchGateway _elasticSearchGateway;
        private readonly IMathTransform _itmWgs84MathTransform;
        private readonly IOsmGeoJsonPreprocessorExecutor _geoJsonPreprocessorExecutor;
        private readonly IHttpGatewayFactory _httpGatewayFactory;
        private readonly ConfigurationData _options;

        private IOsmGateway _osmGateway;

        /// <summary>
        /// Constructor
        /// </summary>
        /// <param name="elasticSearchGateway"></param>
        /// <param name="itmWgs84MathTransform"></param>
        /// <param name="options"></param>
        /// <param name="geoJsonPreprocessorExecutor"></param>
        /// <param name="httpGatewayFactory"></param>
        public OsmLineAdderService(IElasticSearchGateway elasticSearchGateway,
            IMathTransform itmWgs84MathTransform,
            IOptions<ConfigurationData> options,
            IOsmGeoJsonPreprocessorExecutor geoJsonPreprocessorExecutor,
            IHttpGatewayFactory httpGatewayFactory)
        {
            _elasticSearchGateway = elasticSearchGateway;
            _itmWgs84MathTransform = itmWgs84MathTransform;
            _options = options.Value;
            _geoJsonPreprocessorExecutor = geoJsonPreprocessorExecutor;
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
                        nodeIds.Add(await _osmGateway.CreateNode(changesetId, new Node { Id = 0, Latitude = coordinate.Y, Longitude = coordinate.X }));
                        continue;
                    }
                    var itmPoint = GetItmCoordinate(coordinate);
                    var closestItmHighway = itmHighways.First(hw => hw.GetOsmId() == closestCompleteWay.Id.ToString());
                    var closestItmPointInWay = closestItmHighway.Coordinates.OrderBy(c => c.Distance(itmPoint.Coordinate)).First();
                    var indexOnWay = closestItmHighway.Coordinates.ToList().IndexOf(closestItmPointInWay);
                    var closestNodeId = closestCompleteWay.Nodes[indexOnWay].Id.ToString();
                    if (nodeIds.Any() && nodeIds.Last() == closestNodeId)
                    {
                        continue;
                    }
                    if (closestItmPointInWay.Distance(itmPoint.Coordinate) <= _options.DistanceToExisitngLineMergeThreshold)
                    {
                        // close hihgway, adding the node id from that highway
                        nodeIds.Add(closestNodeId);
                        continue;
                    }
                    // need to add a new node to existing highway
                    var newNodeId = await _osmGateway.CreateNode(changesetId, new Node { Id = 0, Latitude = coordinate.Y, Longitude = coordinate.X });
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
            var closeLines = itmHighways.Where(hw => hw.Distance(lineSegment) <= _options.DistanceToExisitngLineMergeThreshold);
            foreach (var closeLine in closeLines)
            {
                var closestPointInExistingLine = closeLine.Coordinates.Select(c => new Point(c)).OrderBy(p => p.Distance(lineSegment)).First();
                if (closestPointInExistingLine.Distance(lineSegment) > _options.DistanceToExisitngLineMergeThreshold)
                {
                    continue;
                }
                var indexInLine = closeLine.Coordinates.ToList().IndexOf(closestPointInExistingLine.Coordinate);
                var completeWay = await _osmGateway.GetCompleteWay(closeLine.GetOsmId());
                var nodeId = completeWay.Nodes[indexInLine].Id.ToString();
                if (nodeIds.Any() && nodeIds.Last() == nodeId)
                {
                    continue;
                }
                nodeIds.Add(nodeId);
            }
        }

        private Way AddNewNodeToExistingWay(string nodeId, CompleteWay closestCompleteWay, LineString closestItmHighway, int indexOnWay, Point itmPoint)
        {
            var indexToInsert = indexOnWay;
            if (indexOnWay != closestItmHighway.Coordinates.Length - 1)
            {
                // HM TODO: fix this using projection
                var postItmLine = new LineString(new [] { closestItmHighway.Coordinates[indexOnWay], closestItmHighway.Coordinates[indexOnWay + 1] });
                if (postItmLine.Distance(itmPoint) <= _options.DistanceToExisitngLineMergeThreshold)
                {
                    indexToInsert = indexOnWay + 1;
                }
            }
            // HM TODO: use the following instead.
            //var simpleWay = (Way)closestCompleteWay.ToSimple();

            var simpleWay = new Way { Tags = closestCompleteWay.Tags, Id = closestCompleteWay.Id, Version = closestCompleteWay.Version, Nodes = closestCompleteWay.Nodes.Select(n => n.Id.Value).ToArray() };
            var updatedList = simpleWay.Nodes.ToList();
            updatedList.Insert(indexToInsert, long.Parse(nodeId));
            simpleWay.Nodes = updatedList.ToArray();
            return simpleWay;
        }

        private async Task<List<Feature>> GetHighwaysInArea(LineString line)
        {
            var northEast = _itmWgs84MathTransform.Inverse().Transform(new Coordinate
            {
                Y = line.Coordinates.Max(c => c.Y),
                X = line.Coordinates.Max(c => c.X)
            });
            var southWest = _itmWgs84MathTransform.Inverse().Transform(new Coordinate
            {
                Y = line.Coordinates.Min(c => c.Y),
                X = line.Coordinates.Min(c => c.X)
            });
            // adding tolerance perimiter to find ways.
            northEast.Y += _options.ClosestPointTolerance;
            northEast.X += _options.ClosestPointTolerance;
            southWest.Y -= _options.ClosestPointTolerance;
            southWest.X -= _options.ClosestPointTolerance;
            var northEastLatLon = _itmWgs84MathTransform.Transform(northEast);
            var southWestLatLon = _itmWgs84MathTransform.Transform(southWest);

            var highways = await _elasticSearchGateway.GetHighways(northEastLatLon, southWestLatLon);
            return highways.ToList();
        }

        private Point GetItmCoordinate(Coordinate coordinate)
        {
            var northEast = _itmWgs84MathTransform.Inverse().Transform(coordinate);
            return new Point(northEast);
        }

        private async Task<CompleteWay> GetClosetHighway(Coordinate coordinate, List<LineString> itmHighways)
        {
            var point = GetItmCoordinate(coordinate);
            if (!itmHighways.Any())
            {
                return null;
            }
            var closestHighway = itmHighways.Where(l => l.Distance(point) <= _options.DistanceToExisitngLineMergeThreshold)
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
            var itmCoordinates = feature.Geometry.Coordinates.Select(_itmWgs84MathTransform.Inverse().Transform).ToArray();
            var lineString = new LineString(itmCoordinates);
            lineString.SetOsmId(feature.Attributes["osm_id"].ToString());
            return lineString;
        }

        private async Task<string> AddWayToOsm(IEnumerable<string> nodeIds, Dictionary<string, string> tags, string chagesetId)
        {
            var way = new Way { Id = 0, Nodes = nodeIds.Select(long.Parse).ToArray() };
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
            var newlyHighwaysFeatures = _geoJsonPreprocessorExecutor.Preprocess(newlyaddedWays.ToList());
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
