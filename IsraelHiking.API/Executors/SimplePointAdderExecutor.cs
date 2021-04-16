using IsraelHiking.API.Services.Osm;
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
        /// This gets the closest highways ordered by distance from the database, checks that it's up to date and update from OSM if needed.
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
            var closestHighways = highways.Where(h => h.Geometry.Distance(point) < _options.ClosestHighwayForGates)
                .OrderBy(h => h.Geometry.Distance(point)).ToArray();

            if (!closestHighways.Any())
            {
                return (null, Array.Empty<Feature>());
            }

            // check for version matching and get updates if needed.
            var closestHighway = closestHighways.First();
            var simpleWay = await osmGateway.GetWay(closestHighway.GetOsmId());
            if (simpleWay.Version == long.Parse(closestHighway.Attributes[FeatureAttributes.POI_VERSION].ToString()))
            {
                return (simpleWay, closestHighways);
            }
            var completeWay = await osmGateway.GetCompleteWay(closestHighway.GetOsmId());
            highways = _osmGeoJsonPreprocessorExecutor.Preprocess(new List<CompleteWay> { completeWay });
            closestHighways[0] = highways.Where(h => h.Geometry.Distance(point) < _options.ClosestHighwayForGates)
                .OrderBy(h => h.Geometry.Distance(point)).FirstOrDefault();
            return (simpleWay, closestHighways);
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
            var closestNode = closestHighway.Geometry.Coordinates.OrderBy(n => n.Distance(coordinate)).FirstOrDefault();
            var closetNodeIndex = Array.FindIndex(closestHighway.Geometry.Coordinates.ToArray(), n => n == closestNode);
            var nodeId = long.Parse(((List<object>)closestHighway.Attributes[FeatureAttributes.POI_OSM_NODES])[closetNodeIndex].ToString());
            var isJunction = closestHighways.Skip(1).Any(f => ((List<object>)f.Attributes[FeatureAttributes.POI_OSM_NODES]).Any(nId => nId.ToString() == nodeId.ToString()));
            return (closestNode, closetNodeIndex, nodeId, isJunction);
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
            (var closestNode, var closetNodeIndex, var nodeId, var isJunction) = GetClosestNodeAndCheckIsJunction(request.LatLng, closestHighways);
            var coordinate = request.LatLng.ToCoordinate();
            if (isJunction == false && closestNode.Distance(coordinate) < _options.ClosestNodeForGates)
            {
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
            // Need to add a node, default location is just before the closest node
            var indexToInsert = closetNodeIndex;

            if (closetNodeIndex == 0)
            {
                var firstSegment = new LineSegment(closestNode, closestHighways.First().Geometry.Coordinates[closetNodeIndex + 1]);
                if (firstSegment.Distance(coordinate) < closestNode.Distance(coordinate)) {
                    indexToInsert = 1;
                }
            }
            else if (closetNodeIndex == closestHighways.First().Geometry.Coordinates.Length - 1)
            {
                var lastSegment = new LineSegment(closestHighways.First().Geometry.Coordinates[closetNodeIndex - 1], closestNode);
                if (lastSegment.Distance(coordinate) >= closestNode.Distance(coordinate))
                {
                    indexToInsert += 1;
                }
            }
            else
            {
                // add in between two points:
                var segmentBefore = new LineSegment(closestHighways.First().Geometry.Coordinates[closetNodeIndex - 1], closestNode);
                var segmentAfter = new LineSegment(closestNode, closestHighways.First().Geometry.Coordinates[closetNodeIndex + 1]);
                var closestSegment = segmentBefore.Distance(coordinate) < segmentAfter.Distance(coordinate) ? segmentBefore : segmentAfter;
                if (closestSegment.Distance(coordinate) >= closestNode.Distance(coordinate))
                {
                    throw new Exception("Closest segment is not in the right aligment to add a node to it");
                }
                if (closestSegment == segmentAfter)
                {
                    indexToInsert += 1;
                }
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
