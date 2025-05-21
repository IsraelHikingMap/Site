using IsraelHiking.API.Executors;
using IsraelHiking.Common;
using IsraelHiking.Common.Configuration;
using IsraelHiking.Common.Extensions;
using Microsoft.Extensions.Options;
using NetTopologySuite.Features;
using NetTopologySuite.Geometries;
using OsmSharp;
using OsmSharp.Changesets;
using OsmSharp.IO.API;
using OsmSharp.Tags;
using ProjNet.CoordinateSystems.Transformations;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using IsraelHiking.DataAccessInterfaces;

namespace IsraelHiking.API.Services.Osm;

/// <inheritdoc/>
public class OsmLineAdderService : IOsmLineAdderService
{
    private readonly IOverpassTurboGateway _overpassTurboGateway;
    private readonly MathTransform _itmWgs84MathTransform;
    private readonly MathTransform _wgs84ItmMathTransform;
    private readonly IOsmGeoJsonPreprocessorExecutor _osmGeoJsonPreprocessorExecutor;
    private readonly GeometryFactory _geometryFactory;
    private readonly ConfigurationData _options;

    private IAuthClient _osmGateway;

    /// <summary>
    /// Constructor
    /// </summary>
    /// <param name="overpassTurboGateway"></param>
    /// <param name="itmWgs84MathTransformFactory"></param>
    /// <param name="options"></param>
    /// <param name="osmGeoJsonPreprocessorExecutor"></param>
    /// <param name="geometryFactory"></param>
    public OsmLineAdderService(IOverpassTurboGateway overpassTurboGateway,
        IItmWgs84MathTransformFactory itmWgs84MathTransformFactory,
        IOptions<ConfigurationData> options,
        IOsmGeoJsonPreprocessorExecutor osmGeoJsonPreprocessorExecutor,
        GeometryFactory geometryFactory)
    {
        _overpassTurboGateway = overpassTurboGateway;
        _itmWgs84MathTransform = itmWgs84MathTransformFactory.Create();
        _wgs84ItmMathTransform = itmWgs84MathTransformFactory.CreateInverse();
        _options = options.Value;
        _osmGeoJsonPreprocessorExecutor = osmGeoJsonPreprocessorExecutor;
        _geometryFactory = geometryFactory;
    }

    /// <inheritdoc/>
    public async Task Add(LineString line, Dictionary<string, string> tags, IAuthClient osmGateway)
    {
        _osmGateway = osmGateway;
        var createdElements = new List<OsmGeo>();
        var modifiedElement = new List<OsmGeo>();
        int generatedId = -1;
        var newWayNodes = new List<Node>();
        var highways = await GetHighwaysInArea(line);
        var itmHighways = highways.Select(ToItmLineString).ToList();
        var waysToUpdateIds = new List<long?>();
        for (int coordinateIndex = 0; coordinateIndex < line.Coordinates.Length; coordinateIndex++)
        {
            var coordinate = line.Coordinates[coordinateIndex];
            if (coordinateIndex > 0)
            {
                var previousCoordinate = line.Coordinates[coordinateIndex - 1];
                AddIntersectingNodes(previousCoordinate, coordinate, newWayNodes, itmHighways, highways);
            }
            var closetHighway = GetClosetHighway(coordinate, itmHighways, highways);
            if (closetHighway == null)
            {
                // no close highways, adding a new node
                var node = new Node {Id = generatedId--, Latitude = coordinate.Y, Longitude = coordinate.X};
                createdElements.Add(node);
                newWayNodes.Add(node);
                continue;
            }
            var itmPoint = GetItmCoordinate(coordinate);
            var closestItmHighway = itmHighways.First(hw => hw.GetOsmId() == closetHighway.GetOsmId());
            var closestItmPointInWay = closestItmHighway.Coordinates.OrderBy(c => c.Distance(itmPoint.Coordinate)).First();
            var indexOnWay = closestItmHighway.Coordinates.ToList().IndexOf(closestItmPointInWay);
            var closestNode = CreateNodeFromExistingHighway(closetHighway, indexOnWay);
            if (!CanAddNewNode(newWayNodes, closestNode.Id.Value))
            {
                continue;
            }
            if (closestItmPointInWay.Distance(itmPoint.Coordinate) <= _options.MaxDistanceToExistingLineForMerge)
            {
                // close highway, adding the node id from that highway
                newWayNodes.Add(closestNode);
                continue;
            }
            // need to add a new node to existing highway
            var newNode = new Node {Id = generatedId--, Latitude = coordinate.Y, Longitude = coordinate.X};
            createdElements.Add(newNode);
            newWayNodes.Add(newNode);
            var indexToInsert = GetIndexToInsert(indexOnWay, closestItmHighway, itmPoint);
            if (modifiedElement.FirstOrDefault(w => w.Id == closestItmHighway.GetOsmId()) is Way modifiedWay &&
                modifiedWay.Nodes[indexToInsert] < 0)
            {
                // a new node was added to this highway - no reason to add a new one to the same location
                continue;
            }
            var simpleWay = await AddNewNodeToExistingWay(newNode, closestItmHighway, indexToInsert);
            modifiedElement.Add(simpleWay);
            waysToUpdateIds.Add(simpleWay.Id);
        }
        CloseLoopWithStartPointIfNeeded(newWayNodes);
        var newWay = CreateWay(newWayNodes, tags, generatedId--);
        createdElements.Add(newWay);
        waysToUpdateIds.Add(newWay.Id);
            
        var changes = new OsmChange
        {
            Create = createdElements.ToArray(),
            Modify = modifiedElement.ToArray(),
            Delete = []
        };
        var changesetId = await _osmGateway.CreateChangeset(CreateCommentFromTags(tags));
        try
        {
            await _osmGateway.UploadChangeset(changesetId, changes);
        }
        finally
        {
            await _osmGateway.CloseChangeset(changesetId);
        }
    }

    /// <summary>
    /// This method checks if a new node should and can be added
    /// </summary>
    /// <param name="newWayNodes"></param>
    /// <param name="newNodeId"></param>
    /// <returns></returns>
    private static bool CanAddNewNode(List<Node> newWayNodes, long newNodeId)
    {
        if (newWayNodes.Any() && newWayNodes.Last().Id == newNodeId)
        {
            // last node that was added had the same ID
            return false;
        }
        var existingNode = newWayNodes.FirstOrDefault(n => n.Id == newNodeId);
        if (existingNode != null && newWayNodes.IndexOf(existingNode) == newWayNodes.Count - 2)
        {
            // avoid creating a self intersecting way
            return false;
        }
        return true;
    }

    /// <summary>
    /// This adds an intersecting node of the new highway if it crosses an existing highway
    /// </summary>
    /// <param name="previousCoordinate"></param>
    /// <param name="coordinate"></param>
    /// <param name="newWayNodes"></param>
    /// <param name="itmHighways"></param>
    /// <param name="highways"></param>
    private void AddIntersectingNodes(Coordinate previousCoordinate, Coordinate coordinate, List<Node> newWayNodes,
        List<LineString> itmHighways, List<IFeature> highways)
    {
        var previousItmPoint = GetItmCoordinate(previousCoordinate);
        var lineSegment = _geometryFactory.CreateLineString([previousItmPoint.Coordinate, GetItmCoordinate(coordinate).Coordinate
        ]);
        var closeItmLines = itmHighways.Where(hw => hw.Distance(lineSegment) <= _options.MaxDistanceToExistingLineForMerge &&
                                                    hw.Distance(previousItmPoint) > _options.MaxDistanceToExistingLineForMerge);
        foreach (var closeItmLine in closeItmLines)
        {
            var closestPointInExistingLine = closeItmLine.Coordinates.Select(c => new Point(c)).OrderBy(p => p.Distance(lineSegment)).First();
            if (closestPointInExistingLine.Distance(lineSegment) > _options.MaxDistanceToExistingLineForMerge)
            {
                continue;
            }
            var indexInLine = closeItmLine.Coordinates.ToList().IndexOf(closestPointInExistingLine.Coordinate);
            var closestHighway = highways.First(x => x.GetOsmId() == closeItmLine.GetOsmId());
            var closestNode = CreateNodeFromExistingHighway(closestHighway, indexInLine);
            if (!CanAddNewNode(newWayNodes, closestNode.Id.Value))
            {
                continue;
            }
            newWayNodes.Add(closestNode);
        }
    }

    /// <summary>
    /// This will add the new node to an exiting way
    /// It will also update the new node to be on the existing way instead of just altering the existing way by
    /// placing the node in the projection location
    /// </summary>
    /// <param name="newNode"></param>
    /// <param name="closestHighwayItm"></param>
    /// <param name="indexToInsert"></param>
    /// <returns></returns>
    private async Task<Way> AddNewNodeToExistingWay(Node newNode, LineString closestHighwayItm, int indexToInsert)
    {
        var simpleWay = await _osmGateway.GetWay(closestHighwayItm.GetOsmId());
        if (indexToInsert != 0 && indexToInsert != simpleWay.Nodes.Length)
        {
            var segment = new LineSegment(closestHighwayItm.Coordinates[indexToInsert - 1], closestHighwayItm.Coordinates[indexToInsert]);
            var (newNodeX, newNodeY) = _wgs84ItmMathTransform.Transform(newNode.Longitude.Value, newNode.Latitude.Value);
            var projectionFactor = segment.ProjectionFactor(new Coordinate(newNodeX, newNodeY));
            var itmCoordinate = segment.PointAlong(projectionFactor);
            if (projectionFactor >= 0 && projectionFactor <= 1)
            {
                var (longitude, latitude) = _itmWgs84MathTransform.Transform(itmCoordinate.X, itmCoordinate.Y);
                newNode.Longitude = longitude;
                newNode.Latitude = latitude;
            }
        }
            
        var updatedList = simpleWay.Nodes.ToList();
        updatedList.Insert(indexToInsert, newNode.Id.Value);
        simpleWay.Nodes = updatedList.ToArray();
        return simpleWay;
    }

    private int GetIndexToInsert(int indexOnWay, LineString closestItmHighway, Point itmPoint)
    {
        var indexToInsert = indexOnWay;
        if (indexOnWay != closestItmHighway.Coordinates.Length - 1)
        {
            var postItmLine = new LineString([closestItmHighway.Coordinates[indexOnWay], closestItmHighway.Coordinates[indexOnWay + 1]
            ]);
            if (postItmLine.Distance(itmPoint) <= _options.MaxDistanceToExistingLineForMerge)
            {
                indexToInsert = indexOnWay + 1;
            }
        }
        return indexToInsert;
    }

    private async Task<List<IFeature>> GetHighwaysInArea(LineString line)
    {
        var northEast = _wgs84ItmMathTransform.Transform(line.Coordinates.Max(c => c.X), line.Coordinates.Max(c => c.Y));
        var southWest = _wgs84ItmMathTransform.Transform(line.Coordinates.Min(c => c.X), line.Coordinates.Min(c => c.Y));
        // adding tolerance perimeter to find ways.
        northEast.y += _options.MinimalDistanceToClosestPoint;
        northEast.x += _options.MinimalDistanceToClosestPoint;
        southWest.y -= _options.MinimalDistanceToClosestPoint;
        southWest.x -= _options.MinimalDistanceToClosestPoint;
        var northEastLatLon = _itmWgs84MathTransform.Transform(northEast.x, northEast.y);
        var southWestLatLon = _itmWgs84MathTransform.Transform(southWest.x, southWest.y);

        var ways = await _overpassTurboGateway.GetHighways(new Coordinate(northEastLatLon.x, northEastLatLon.y), 
            new Coordinate(southWestLatLon.x, southWestLatLon.y));
        var highways = _osmGeoJsonPreprocessorExecutor.Preprocess(ways);
        return highways.ToList();
    }

    private Point GetItmCoordinate(Coordinate coordinate)
    {
        var northEast = _wgs84ItmMathTransform.Transform(coordinate.X, coordinate.Y);
        return new Point(northEast.x, northEast.y);
    }

    private IFeature GetClosetHighway(Coordinate coordinate, List<LineString> itmHighways, List<IFeature> highways)
    {
        var point = GetItmCoordinate(coordinate);
        if (!itmHighways.Any())
        {
            return null;
        }
        var closestHighway = itmHighways.Where(l => l.Distance(point) <= _options.MaxDistanceToExistingLineForMerge)
            .OrderBy(l => l.Distance(point))
            .FirstOrDefault();
        return closestHighway == null 
            ? null 
            : highways.First(h => h.GetOsmId() == closestHighway.GetOsmId());
    }

    private LineString ToItmLineString(IFeature feature)
    {
        var itmCoordinates = feature.Geometry.Coordinates.Select(c => _wgs84ItmMathTransform.Transform(c.X, c.Y)).Select(c => new Coordinate(c.x, c.y)).ToArray();
        var lineString = new LineString(itmCoordinates);
        lineString.SetOsmId(feature.GetOsmId());
        return lineString;
    }

    private Way CreateWay(IEnumerable<Node> newWayNodes, Dictionary<string, string> tags, long id)
    {
        var way = new Way
        {
            Id = id,
            Nodes = newWayNodes.Select(n => n.Id.Value).ToArray(),
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
        return $"Added a missing {colour}{highway} from a GPS trace using {Branding.BASE_URL}";
    }

    /// <summary>
    /// This method tries to find two coordinates that their segment is the closest to the first coordinate of the line
    /// In this case the first coordinate should be added to the way to create a close loop
    /// Assuming of course it is inside the merge points threshold
    /// </summary>
    private void CloseLoopWithStartPointIfNeeded(List<Node> newWayNodes)
    {
        if (newWayNodes.Count < 3)
        {
            return;
        }
        var coordinates = newWayNodes.Select(n => new Coordinate(n.Longitude.Value, n.Latitude.Value)).ToArray();
        var itmLine = ToItmLineString(new Feature { Geometry = _geometryFactory.CreateLineString(coordinates), Attributes = new AttributesTable { { FeatureAttributes.ID, "-1000" } } });
        var firstItmCoordinate = itmLine.Coordinates.First();
        var indexOfFirstDistantPoint = 1;
        while (indexOfFirstDistantPoint < itmLine.Length)
        {
            if (itmLine[indexOfFirstDistantPoint].Distance(firstItmCoordinate) > _options.MinimalDistanceToClosestPoint)
            {
                break;
            }
            indexOfFirstDistantPoint++;
        }
        if (indexOfFirstDistantPoint >= itmLine.Length - 1)
        {
            return;
        }
        LineSegment closestSegment = null;
        for (int indexOnLine = indexOfFirstDistantPoint + 1; indexOnLine < itmLine.Coordinates.Length; indexOnLine++)
        {
            var segment = new LineSegment(itmLine.Coordinates[indexOnLine - 1], itmLine.Coordinates[indexOnLine]);
            if (segment.Distance(firstItmCoordinate) > _options.MaxDistanceToExistingLineForMerge)
            {
                continue;
            }
            if (closestSegment == null || closestSegment.Distance(firstItmCoordinate) > segment.Distance(firstItmCoordinate))
            {
                closestSegment = segment;
            }
        }
        if (closestSegment == null)
        {
            return;
        }
        newWayNodes.Insert(itmLine.Coordinates.ToList().IndexOf(closestSegment.P1), newWayNodes.First());
    }

    private Node CreateNodeFromExistingHighway(IFeature closetHighway, int indexOnWay)
    {
        var closestNodeId = ((long?[])closetHighway.Attributes[FeatureAttributes.POI_OSM_NODES]).ElementAt(indexOnWay).Value;
        return new Node
        {
            Id = closestNodeId,
            Latitude = closetHighway.Geometry.Coordinates[indexOnWay].Y,
            Longitude = closetHighway.Geometry.Coordinates[indexOnWay].X
        };
    }
}