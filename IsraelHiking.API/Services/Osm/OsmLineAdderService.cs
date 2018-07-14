using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using GeoAPI.CoordinateSystems.Transformations;
using GeoAPI.Geometries;
using IsraelHiking.API.Executors;
using IsraelHiking.Common;
using IsraelHiking.Common.Extensions;
using IsraelHiking.DataAccessInterfaces;
using NetTopologySuite.Features;
using NetTopologySuite.Geometries;
using OsmSharp;
using OsmSharp.Tags;
using Microsoft.Extensions.Options;
using OsmSharp.Changesets;

namespace IsraelHiking.API.Services.Osm
{
    /// <inheritdoc/>
    public class OsmLineAdderService : IOsmLineAdderService
    {
        private readonly IElasticSearchGateway _elasticSearchGateway;
        private readonly IMathTransform _itmWgs84MathTransform;
        private readonly IMathTransform _wgs84ItmMathTransform;
        private readonly IOsmGeoJsonPreprocessorExecutor _geoJsonPreprocessorExecutor;
        private readonly IHttpGatewayFactory _httpGatewayFactory;
        private readonly ConfigurationData _options;

        private IOsmGateway _osmGateway;

        /// <summary>
        /// Constructor
        /// </summary>
        /// <param name="elasticSearchGateway"></param>
        /// <param name="itmWgs84MathTransfromFactory"></param>
        /// <param name="options"></param>
        /// <param name="geoJsonPreprocessorExecutor"></param>
        /// <param name="httpGatewayFactory"></param>
        public OsmLineAdderService(IElasticSearchGateway elasticSearchGateway,
            IItmWgs84MathTransfromFactory itmWgs84MathTransfromFactory,
            IOptions<ConfigurationData> options,
            IOsmGeoJsonPreprocessorExecutor geoJsonPreprocessorExecutor,
            IHttpGatewayFactory httpGatewayFactory)
        {
            _elasticSearchGateway = elasticSearchGateway;
            _itmWgs84MathTransform = itmWgs84MathTransfromFactory.Create();
            _wgs84ItmMathTransform = itmWgs84MathTransfromFactory.CreateInverse();
            _options = options.Value;
            _geoJsonPreprocessorExecutor = geoJsonPreprocessorExecutor;
            _httpGatewayFactory = httpGatewayFactory;
        }

        /// <inheritdoc/>
        public async Task Add(LineString line, Dictionary<string, string> tags, TokenAndSecret tokenAndSecret)
        {
            _osmGateway = _httpGatewayFactory.CreateOsmGateway(tokenAndSecret);
            var createdElements = new List<OsmGeo>();
            var modifiedElement = new List<OsmGeo>();
            int generatedId = -1;
            var nodeIds = new List<string>();
            var highways = await GetHighwaysInArea(line);
            var itmHighways = highways.Select(ToItmLineString).ToList();
            var waysToUpdateIds = new List<long?>();
            for (int coordinateIndex = 0; coordinateIndex < line.Coordinates.Length; coordinateIndex++)
            {
                var coordinate = line.Coordinates[coordinateIndex];
                if (coordinateIndex > 0)
                {
                    var previousCoordinate = line.Coordinates[coordinateIndex - 1];
                    AddIntersectingNodes(previousCoordinate, coordinate, nodeIds, itmHighways, highways);
                }
                var closetHighway = GetClosetHighway(coordinate, itmHighways, highways);
                if (closetHighway == null)
                {
                    // no close highways, adding a new node
                    var node = new Node {Id = generatedId--, Latitude = coordinate.Y, Longitude = coordinate.X};
                    createdElements.Add(node);
                    nodeIds.Add(node.Id.ToString());
                    continue;
                }
                var itmPoint = GetItmCoordinate(coordinate);
                var closestItmHighway = itmHighways.First(hw => hw.GetOsmId() == closetHighway.GetOsmId());
                var closestItmPointInWay = closestItmHighway.Coordinates.OrderBy(c => c.Distance(itmPoint.Coordinate)).First();
                var indexOnWay = closestItmHighway.Coordinates.ToList().IndexOf(closestItmPointInWay);
                var closestNodeId = ((List<object>)closetHighway.Attributes[FeatureAttributes.OSM_NODES])[indexOnWay].ToString();
                if (!CanAddNewNode(nodeIds, closestNodeId))
                {
                    continue;
                }
                if (closestItmPointInWay.Distance(itmPoint.Coordinate) <= _options.MaxDistanceToExisitngLineForMerge)
                {
                    // close hihgway, adding the node id from that highway
                    nodeIds.Add(closestNodeId);
                    continue;
                }
                // need to add a new node to existing highway
                var newNode = new Node {Id = generatedId--, Latitude = coordinate.Y, Longitude = coordinate.X};
                createdElements.Add(newNode);
                nodeIds.Add(newNode.Id.ToString());
                var simpleWay = await AddNewNodeToExistingWay(newNode.Id.ToString(), closestItmHighway, indexOnWay, itmPoint);
                modifiedElement.Add(simpleWay);
                waysToUpdateIds.Add(simpleWay.Id);
            }
            var newWay = CreateWay(nodeIds, tags, generatedId--);
            createdElements.Add(newWay);
            waysToUpdateIds.Add(newWay.Id);
            
            var changes = new OsmChange
            {
                Create = createdElements.ToArray(),
                Modify = modifiedElement.ToArray(),
                Delete = new OsmGeo[0]
            };
            var changesetId = await _osmGateway.CreateChangeset(CreateCommentFromTags(tags));
            try
            {
                var diffResult = await _osmGateway.UploadChangeset(changesetId, changes);
                waysToUpdateIds = waysToUpdateIds.Select(id =>
                {
                    var newIdResult = diffResult.Results.FirstOrDefault(r => r.OldId.Equals(id));
                    return newIdResult?.NewId ?? id;
                }).ToList();
                await AddWaysToElasticSearch(waysToUpdateIds);
            }
            finally
            {
                await _osmGateway.CloseChangeset(changesetId);
            }
        }

        private static bool CanAddNewNode(List<string> nodeIds, string newNodeId)
        {
            if (nodeIds.Any() && nodeIds.Last() == newNodeId)
            {
                return false;
            }
            if (nodeIds.Contains(newNodeId) && nodeIds.IndexOf(newNodeId) == nodeIds.Count - 2)
            {
                // avoid creating a self intersecting way
                return false;
            }
            return true;
        }

        private void AddIntersectingNodes(Coordinate previousCoordinate, Coordinate coordinate, List<string> nodeIds,
            List<LineString> itmHighways, List<Feature> highways)
        {
            var previousItmPoint = GetItmCoordinate(previousCoordinate);
            var lineSegment = new LineString(new [] { previousItmPoint.Coordinate, GetItmCoordinate(coordinate).Coordinate});
            var closeLines = itmHighways.Where(hw => hw.Distance(lineSegment) <= _options.MaxDistanceToExisitngLineForMerge &&
                                                     hw.Distance(previousItmPoint) > _options.MaxDistanceToExisitngLineForMerge);
            foreach (var closeLine in closeLines)
            {
                var closestPointInExistingLine = closeLine.Coordinates.Select(c => new Point(c)).OrderBy(p => p.Distance(lineSegment)).First();
                if (closestPointInExistingLine.Distance(lineSegment) > _options.MaxDistanceToExisitngLineForMerge)
                {
                    continue;
                }
                var indexInLine = closeLine.Coordinates.ToList().IndexOf(closestPointInExistingLine.Coordinate);
                var closestHighway = highways.First(x => x.GetOsmId() == closeLine.GetOsmId());

                var nodeId = ((List<object>)closestHighway.Attributes[FeatureAttributes.OSM_NODES])[indexInLine].ToString();
                if (!CanAddNewNode(nodeIds, nodeId))
                {
                    continue;
                }
                nodeIds.Add(nodeId);
            }
        }

        private async Task<Way> AddNewNodeToExistingWay(string nodeId, LineString closestItmHighway, int indexOnWay, Point itmPoint)
        {
            var indexToInsert = indexOnWay;
            if (indexOnWay != closestItmHighway.Coordinates.Length - 1)
            {
                // HM TODO: fix this using projection
                var postItmLine = new LineString(new [] { closestItmHighway.Coordinates[indexOnWay], closestItmHighway.Coordinates[indexOnWay + 1] });
                if (postItmLine.Distance(itmPoint) <= _options.MaxDistanceToExisitngLineForMerge)
                {
                    indexToInsert = indexOnWay + 1;
                }
            }

            var simpleWay = await _osmGateway.GetWay(closestItmHighway.GetOsmId());
            var updatedList = simpleWay.Nodes.ToList();
            updatedList.Insert(indexToInsert, long.Parse(nodeId));
            simpleWay.Nodes = updatedList.ToArray();
            return simpleWay;
        }

        private async Task<List<Feature>> GetHighwaysInArea(LineString line)
        {
            var northEast = _wgs84ItmMathTransform.Transform(new Coordinate
            {
                Y = line.Coordinates.Max(c => c.Y),
                X = line.Coordinates.Max(c => c.X)
            });
            var southWest = _wgs84ItmMathTransform.Transform(new Coordinate
            {
                Y = line.Coordinates.Min(c => c.Y),
                X = line.Coordinates.Min(c => c.X)
            });
            // adding tolerance perimiter to find ways.
            northEast.Y += _options.MinimalDistanceToClosestPoint;
            northEast.X += _options.MinimalDistanceToClosestPoint;
            southWest.Y -= _options.MinimalDistanceToClosestPoint;
            southWest.X -= _options.MinimalDistanceToClosestPoint;
            var northEastLatLon = _itmWgs84MathTransform.Transform(northEast);
            var southWestLatLon = _itmWgs84MathTransform.Transform(southWest);

            var highways = await _elasticSearchGateway.GetHighways(northEastLatLon, southWestLatLon);
            return highways.ToList();
        }

        private Point GetItmCoordinate(Coordinate coordinate)
        {
            var northEast = _wgs84ItmMathTransform.Transform(coordinate);
            return new Point(northEast);
        }

        private Feature GetClosetHighway(Coordinate coordinate, List<LineString> itmHighways, List<Feature> highways)
        {
            var point = GetItmCoordinate(coordinate);
            if (!itmHighways.Any())
            {
                return null;
            }
            var closestHighway = itmHighways.Where(l => l.Distance(point) <= _options.MaxDistanceToExisitngLineForMerge)
                .OrderBy(l => l.Distance(point))
                .FirstOrDefault();
            if (closestHighway == null)
            {
                return null;
            }
            return highways.First(h => h.GetOsmId() == closestHighway.GetOsmId());
        }

        private LineString ToItmLineString(Feature feature)
        {
            var itmCoordinates = feature.Geometry.Coordinates.Select(_wgs84ItmMathTransform.Transform).ToArray();
            var lineString = new LineString(itmCoordinates);
            lineString.SetOsmId(feature.GetOsmId());
            return lineString;
        }

        private Way CreateWay(IEnumerable<string> nodeIds, Dictionary<string, string> tags, long id)
        {
            var way = new Way
            {
                Id = id,
                Nodes = nodeIds.Select(long.Parse).ToArray(),
                Tags = new TagsCollection(tags)
                {
                    {"note", "Added by IHM algorithm - fixing maybe needed"}
                }
            };
            if (way.Tags.ContainsKey("source") == false)
            {
                way.Tags.Add("source", "GPS");
            }
            return way;
        }

        private async Task AddWaysToElasticSearch(List<long?> wayIds)
        {
            var tasksList = wayIds.Select(wayId => _osmGateway.GetCompleteWay(wayId.ToString())).ToList();
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
