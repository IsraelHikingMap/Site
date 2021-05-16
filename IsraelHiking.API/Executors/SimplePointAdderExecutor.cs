﻿using IsraelHiking.API.Services.Osm;
using IsraelHiking.Common;
using IsraelHiking.Common.Api;
using IsraelHiking.Common.Configuration;
using IsraelHiking.Common.Extensions;
using IsraelHiking.DataAccessInterfaces.Repositories;
using Microsoft.Extensions.Options;
using NetTopologySuite.Features;
using NetTopologySuite.Geometries;
using OsmSharp;
using OsmSharp.Changesets;
using OsmSharp.Complete;
using OsmSharp.IO.API;
using OsmSharp.Tags;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;

namespace IsraelHiking.API.Executors
{
    /// <inheritdoc/>
    public class SimplePointAdderExecutor : ISimplePointAdderExecutor
    {
        private readonly IHighwaysRepository _highwaysRepository;
        private readonly IOsmGeoJsonPreprocessorExecutor _osmGeoJsonPreprocessorExecutor;
        private readonly ConfigurationData _options;

        /// <summary>
        /// Constructor
        /// </summary>
        /// <param name="options"></param>
        /// <param name="highwaysRepository"></param>
        /// <param name="osmGeoJsonPreprocessorExecutor"></param>
        public SimplePointAdderExecutor(IOptions<ConfigurationData> options,
            IHighwaysRepository highwaysRepository,
            IOsmGeoJsonPreprocessorExecutor osmGeoJsonPreprocessorExecutor)
        {
            _highwaysRepository = highwaysRepository;
            _osmGeoJsonPreprocessorExecutor = osmGeoJsonPreprocessorExecutor;
            _options = options.Value;
        }

        /// <inheritdoc/>
        public async Task Add(IAuthClient osmGateway, AddSimplePointOfInterestRequest request)
        {
            var change = await GetOsmChange(osmGateway, request);
            var changesetId = await osmGateway.CreateChangeset($"Uploading simple POI, type: {request.PointType} using IsraelHiking.osm.org.il");
            await osmGateway.UploadChangeset(changesetId, change);
            await osmGateway.CloseChangeset(changesetId);
            var modifiedWay = change.Modify?.OfType<Way>().FirstOrDefault();
            if (modifiedWay != null)
            {
                var completeWay = await osmGateway.GetCompleteWay(modifiedWay.Id.Value);
                var updatedHighways = _osmGeoJsonPreprocessorExecutor.Preprocess(new List<CompleteWay> { completeWay });
                await _highwaysRepository.UpdateHighwaysData(updatedHighways);
            }
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
        private async Task<(Way, Feature[])> GetClosestHighways(IAuthClient osmGateway, LatLng latLng)
        {
            var diff = 0.003; // get hihgways around 300 m radius not to miss highways (elastic bug?)
            var highways = await _highwaysRepository.GetHighways(new Coordinate(latLng.Lng + diff, latLng.Lat + diff),
                new Coordinate(latLng.Lng - diff, latLng.Lat - diff));
            var point = new Point(latLng.Lng, latLng.Lat);
            var closestHighways = highways.Where(h => DistanceWithPolygonFix(h.Geometry, point) < _options.ClosestHighwayForGates)
                .OrderBy(h => DistanceWithPolygonFix(h.Geometry, point)).ToArray();

            if (!closestHighways.Any())
            {
                return (null, Array.Empty<Feature>());
            }

            // check for version matching and get updates if needed.
            var closestHighway = closestHighways.First();
            var simpleWay = await osmGateway.GetWay(closestHighway.GetOsmId());
            if (simpleWay.Version == long.Parse(closestHighway.Attributes[FeatureAttributes.POI_VERSION].ToString()))
            {
                return (simpleWay, closestHighways.ToArray());
            }
            // The highway in the database is not up-to-date, need to fetch it from OSM.
            var completeWay = await osmGateway.GetCompleteWay(closestHighway.GetOsmId());
            var firstHighway = _osmGeoJsonPreprocessorExecutor.Preprocess(new List<CompleteWay> { completeWay }).FirstOrDefault();
            if (firstHighway == null) {
                // This is a rate case where the next version of the highway doesn't contain any tags 
                // and it was a highway when the highways database wes built
                return (null, Array.Empty<Feature>());
            }
            // The following assumes that after the highway version upgrade this is still the closest highway 
            // Ignoring this assumption will require to redo the entire process to another highway 
            // which seems too complicated and has very low probability...
            closestHighways[0] = firstHighway;
            return (simpleWay, closestHighways);
        }

        private double DistanceWithPolygonFix(Geometry geometry, Point point)
        {
            if (geometry is Polygon polygon)
            {
                return DistanceToPolygon(polygon, point);
            }
            if (geometry is MultiPolygon multiPolygon)
            {
                return multiPolygon.OfType<Polygon>().Min(p => DistanceToPolygon(p, point));
            }
            return geometry.Distance(point);
        }

        private double DistanceToPolygon(Polygon polygon, Point point)
        {
            if (!polygon.Contains(point))
            {
                return polygon.Distance(point);
            }
            return polygon.InteriorRings.Concat(new[] { polygon.ExteriorRing }).Min(l => l.Distance(point));
        }

        /// <summary>
        /// This method receives the closest highways and finds the closest node, and checks if it is a juction node
        /// </summary>
        /// <param name="latLng"></param>
        /// <param name="closestHighways"></param>
        /// <returns>The closest node, its index in the way and whether it is a junction node</returns>
        private (Coordinate, int, long, bool) GetClosestNodeAndCheckIsJunction(LatLng latLng, Feature[] closestHighways)
        {
            var coordinate = latLng.ToCoordinate();
            var closestHighway = closestHighways.First();
            var closestNodeCoordinate = closestHighway.Geometry.Coordinates.OrderBy(n => n.Distance(coordinate)).FirstOrDefault();
            var closetNodeIndex = Array.FindIndex(closestHighway.Geometry.Coordinates.ToArray(), n => n == closestNodeCoordinate);
            var nodeId = long.Parse(((List<object>)closestHighway.Attributes[FeatureAttributes.POI_OSM_NODES])[closetNodeIndex].ToString());
            var isJunction = closestHighways.Skip(1).Any(f => ((List<object>)f.Attributes[FeatureAttributes.POI_OSM_NODES]).Any(nId => nId.ToString() == nodeId.ToString()));
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
                    Create = new[] { newNode }
                };
            }

            (var way, var closestHighways) = await GetClosestHighways(osmGateway, request.LatLng);
            if (!closestHighways.Any())
            {
                throw new Exception("There's no close enough highway to add a gate");
            }
            (var closestNodeCoordinate, var closetNodeIndex, var nodeId, var isJunction) = GetClosestNodeAndCheckIsJunction(request.LatLng, closestHighways);
            var newNodeCoordinate = request.LatLng.ToCoordinate();
            if (isJunction || closestNodeCoordinate.Distance(newNodeCoordinate) >= _options.ClosestNodeForGates)
            {
                // Need to add a node to the closest way
                var indexToInsert = GetIndexToInsert(closetNodeIndex, closestNodeCoordinate, closestHighways, newNodeCoordinate);
                return CreateUpdateWayChangeFromData(way, indexToInsert, newNode, closestHighways.First());
            }
            // Close enough to a node and not a juction -> updating this node
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
                Modify = new[] { nodeToUpdate }
            };
        }

        private int GetIndexToInsert(int closetNodeIndex, Coordinate closestNodeCoordinate, Feature[] closestHighways, Coordinate newNodeCoordinate)
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

        private OsmChange CreateUpdateWayChangeFromData(Way way, int indexToInsert, Node newNode, Feature closestHighway)
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
                Create = new[] { newNode },
                Modify = new[] { way }
            };
        }
    }
}
