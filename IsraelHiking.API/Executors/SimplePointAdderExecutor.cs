using IsraelHiking.API.Services.Osm;
using IsraelHiking.Common;
using IsraelHiking.Common.Api;
using IsraelHiking.Common.Configuration;
using IsraelHiking.Common.Extensions;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using NetTopologySuite.Features;
using NetTopologySuite.Geometries;
using OsmSharp;
using OsmSharp.Changesets;
using OsmSharp.IO.API;
using OsmSharp.Tags;
using System;
using System.Linq;
using System.Threading.Tasks;
using IsraelHiking.DataAccessInterfaces;

namespace IsraelHiking.API.Executors;

/// <inheritdoc/>
public class SimplePointAdderExecutor(
    IOptions<ConfigurationData> options,
    IOverpassTurboGateway overpassTurboGateway,
    IOsmGeoJsonPreprocessorExecutor osmGeoJsonPreprocessorExecutor,
    ILogger logger) : ISimplePointAdderExecutor
{

    /// <inheritdoc/>
    public async Task Add(IAuthClient osmGateway, AddSimplePointOfInterestRequest request)
    {
        var change = await GetOsmChange(osmGateway, request);
        await osmGateway.UploadToOsmWithRetries(
            $"Uploading simple POI, type: {request.PointType} using {Branding.BASE_URL}",
            async changeSetId => await osmGateway.UploadChangeset(changeSetId, change),
            logger);
    }

    private TagsCollection ConvertPointTypeToTags(SimplePointType pointType)
    {
        return pointType switch
        {
            SimplePointType.Tap => new TagsCollection { { "amenity", "drinking_water" } },
            SimplePointType.Parking => new TagsCollection { { "amenity", "parking" } },
            SimplePointType.Block => new TagsCollection {
                { "barrier", "yes" },
                { "motor_vehicle", "no" }
            },
            SimplePointType.CattleGrid => new TagsCollection { { "barrier", "cattle_grid" } },
            SimplePointType.ClosedGate => new TagsCollection {
                { "barrier", "gate" },
                { "access", "no" }
            },
            SimplePointType.OpenGate => new TagsCollection {
                { "barrier", "gate" },
                { "access", "yes" }
            },
            SimplePointType.PicnicSite => new TagsCollection { { "tourism", "picnic_site" } },
            SimplePointType.Bench => new TagsCollection { { "amenity", "bench" } },
            _ => throw new Exception("Invalid point type for finding relevant tags" + pointType),
        };
    }

    private bool NeedsToBeAddedToClosestLine(SimplePointType pointType)
    {
        return pointType switch
        {
            SimplePointType.Tap => false,
            SimplePointType.Parking => false,
            SimplePointType.Block => true,
            SimplePointType.CattleGrid => true,
            SimplePointType.ClosedGate => true,
            SimplePointType.OpenGate => true,
            SimplePointType.PicnicSite => false,
            SimplePointType.Bench => false,
            _ => throw new Exception("Invalid point type for closest line check" + pointType),
        };
    }

    /// <summary>
    /// This gets the closest highways ordered by distance from the database, 
    /// checks the closest is up-to-date and updates from OSM if needed.
    /// </summary>
    /// <param name="osmGateway"></param>
    /// <param name="latLng"></param>
    /// <returns>The way from OSM and the equivalent feature, and also all the other closest highways</returns>
    private async Task<(Way, IFeature[])> GetClosestHighways(IAuthClient osmGateway, LatLng latLng)
    {
        var diff = 0.003; // get highways around 300 m radius not to miss highways (elastic bug?)
        var ways = await overpassTurboGateway.GetHighways(new Coordinate(latLng.Lng + diff, latLng.Lat + diff),
            new Coordinate(latLng.Lng - diff, latLng.Lat - diff));
        var highways = osmGeoJsonPreprocessorExecutor.Preprocess(ways);
        var point = new Point(latLng.Lng, latLng.Lat);
        var closestHighways = highways.Where(h => DistanceWithPolygonFix(h.Geometry, point) < options.Value.ClosestHighwayForGates)
            .OrderBy(h => DistanceWithPolygonFix(h.Geometry, point)).ToArray();

        if (!closestHighways.Any())
        {
            return (null, []);
        }

        // check for version matching and get updates if needed.
        var closestHighway = closestHighways.First();
        var simpleWay = await osmGateway.GetWay(closestHighway.GetOsmId());
        if (simpleWay.Version == long.Parse(closestHighway.Attributes[FeatureAttributes.POI_VERSION].ToString() ?? string.Empty))
        {
            return (simpleWay, closestHighways.ToArray());
        }
        // The highway in the database is not up-to-date, need to fetch it from OSM.
        var completeWay = await osmGateway.GetCompleteWay(closestHighway.GetOsmId());
        var firstHighway = osmGeoJsonPreprocessorExecutor.Preprocess([completeWay]).FirstOrDefault();
        if (firstHighway == null) {
            // This is a rate case where the next version of the highway doesn't contain any tags, 
            // and it was a highway when the highways database wes built
            return (null, []);
        }
        // The following assumes that after the highway version upgrade this is still the closest highway 
        // Ignoring this assumption will require to redo the entire process to another highway 
        // which seems too complicated and has very low probability...
        closestHighways[0] = firstHighway;
        return (simpleWay, closestHighways);
    }

    private double DistanceWithPolygonFix(Geometry geometry, Point point)
    {
        return geometry switch
        {
            Polygon polygon => DistanceToPolygon(polygon, point),
            _ => geometry.Distance(point)
        };
    }

    private double DistanceToPolygon(Polygon polygon, Point point)
    {
        return !polygon.Contains(point)
            ? polygon.Distance(point)
            : polygon.InteriorRings.Concat([polygon.ExteriorRing]).Min(l => l.Distance(point));
    }

    /// <summary>
    /// This method receives the closest highways and finds the closest node, and checks if it is a junction node
    /// </summary>
    /// <param name="latLng"></param>
    /// <param name="closestHighways"></param>
    /// <returns>The closest node, its index in the way and whether it is a junction node</returns>
    private (Coordinate, int, long, bool) GetClosestNodeAndCheckIsJunction(LatLng latLng, IFeature[] closestHighways)
    {
        var coordinate = latLng.ToCoordinate();
        var closestHighway = closestHighways.First();
        var closestNodeCoordinate = closestHighway.Geometry.Coordinates.OrderBy(n => n.Distance(coordinate)).FirstOrDefault();
        var closetNodeIndex = Array.FindIndex(closestHighway.Geometry.Coordinates.ToArray(), n => n.Equals(closestNodeCoordinate));
        var nodeId = ((long?[])closestHighway.Attributes[FeatureAttributes.POI_OSM_NODES]).ElementAt(closetNodeIndex).Value;
        var isJunction = closestHighways.Skip(1).Any(f => ((long?[])f.Attributes[FeatureAttributes.POI_OSM_NODES]).Any(nId => nId == nodeId));
        return (closestNodeCoordinate, closetNodeIndex, nodeId, isJunction);
    }

    private async Task<OsmChange> GetOsmChange(IAuthClient osmGateway, AddSimplePointOfInterestRequest request)
    {
        var newNode = new Node
        {
            Id = -1,
            Latitude = request.LatLng.Lat,
            Longitude = request.LatLng.Lng,
            Tags = ConvertPointTypeToTags(request.PointType)
        };
        if (NeedsToBeAddedToClosestLine(request.PointType) == false)
        {
            return new OsmChange
            {
                Create = [newNode]
            };
        }

        var (way, closestHighways) = await GetClosestHighways(osmGateway, request.LatLng);
        if (!closestHighways.Any())
        {
            return new OsmChange
            {
                Create = [newNode]
            };
        }
        var (closestNodeCoordinate, closetNodeIndex, nodeId, isJunction) = GetClosestNodeAndCheckIsJunction(request.LatLng, closestHighways);
        var newNodeCoordinate = request.LatLng.ToCoordinate();
        if (isJunction || closestNodeCoordinate.Distance(newNodeCoordinate) >= options.Value.ClosestNodeForGates)
        {
            // Need to add a node to the closest way
            var indexToInsert = GetIndexToInsert(closetNodeIndex, closestNodeCoordinate, closestHighways, newNodeCoordinate);
            return CreateUpdateWayChangeFromData(way, indexToInsert, newNode, closestHighways.First());
        }
        // Close enough to a node and not a junction -> updating this node
        var nodeToUpdate = await osmGateway.GetNode(nodeId);
        if (nodeToUpdate.Tags == null)
        {
            nodeToUpdate.Tags = newNode.Tags;
        }
        else
        {
            foreach (var tag in newNode.Tags)
            {
                nodeToUpdate.Tags.AddOrReplace(tag);
            }
        }

        return new OsmChange
        {
            Modify = [nodeToUpdate]
        };
    }

    private int GetIndexToInsert(int closetNodeIndex, Coordinate closestNodeCoordinate, IFeature[] closestHighways, Coordinate newNodeCoordinate)
    {
        // Default location is before the closest node
        var indexToInsert = closetNodeIndex;

        if (closetNodeIndex == 0)
        {
            var firstSegment = new LineSegment(closestNodeCoordinate, closestHighways.First().Geometry.Coordinates[closetNodeIndex + 1]);
            if (firstSegment.Distance(newNodeCoordinate) < closestNodeCoordinate.Distance(newNodeCoordinate))
            {
                indexToInsert = 1;
            }
        }
        else if (closetNodeIndex == closestHighways.First().Geometry.Coordinates.Length - 1)
        {
            var lastSegment = new LineSegment(closestHighways.First().Geometry.Coordinates[closetNodeIndex - 1], closestNodeCoordinate);
            if (lastSegment.Distance(newNodeCoordinate) >= closestNodeCoordinate.Distance(newNodeCoordinate))
            {
                indexToInsert += 1;
            }
        }
        else
        {
            // add in between two points:
            var segmentBefore = new LineSegment(closestHighways.First().Geometry.Coordinates[closetNodeIndex - 1], closestNodeCoordinate);
            var segmentAfter = new LineSegment(closestNodeCoordinate, closestHighways.First().Geometry.Coordinates[closetNodeIndex + 1]);
            var closestSegment = segmentBefore.Distance(newNodeCoordinate) < segmentAfter.Distance(newNodeCoordinate) ? segmentBefore : segmentAfter;
            if (closestSegment.Distance(newNodeCoordinate) >= closestNodeCoordinate.Distance(newNodeCoordinate))
            {
                throw new Exception("Closest segment is not in the right aligment to add a node to it");
            }
            if (closestSegment == segmentAfter)
            {
                indexToInsert += 1;
            }
        }
        return indexToInsert;
    }

    private OsmChange CreateUpdateWayChangeFromData(Way way, int indexToInsert, Node newNode, IFeature closestHighway)
    {
        if (indexToInsert != 0 && indexToInsert != way.Nodes.Length)
        {
            var segment = new LineSegment(closestHighway.Geometry.Coordinates[indexToInsert - 1], closestHighway.Geometry.Coordinates[indexToInsert]);
            var projectionFactor = segment.ProjectionFactor(new Coordinate(newNode.Longitude.Value, newNode.Latitude.Value));
            var coordinate = segment.PointAlong(projectionFactor);
            newNode.Longitude = coordinate.X;
            newNode.Latitude = coordinate.Y;
        }
        var updatedList = way.Nodes.ToList();
        updatedList.Insert(indexToInsert, -1);
        way.Nodes = updatedList.ToArray();
        return new OsmChange
        {
            Create = [newNode],
            Modify = [way]
        };
    }
}