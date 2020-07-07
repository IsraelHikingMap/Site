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
                SimplePointType.Tap => new TagsCollection { { "amenity", "diriking_water" } },
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
                _ => throw new Exception("Invalid point type " + pointType),
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
                _ => throw new Exception("Invalid point type " + pointType),
            };
        }

        private async Task<Feature> GetClosestHighway(LatLng latLng)
        {
            var diff = 0.003; // get hihgways around 300 m radius not to miss highways (elastic bug?)
            var highways = await _highwaysRepository.GetHighways(new Coordinate(latLng.Lng + diff, latLng.Lat + diff),
                new Coordinate(latLng.Lng - diff, latLng.Lat - diff));
            var point = new Point(latLng.Lng, latLng.Lat);
            var closest = highways.Where(h => h.Geometry.Distance(point) < _options.ClosestHighwayForGates)
                .OrderBy(h => h.Geometry.Distance(point)).FirstOrDefault();
            return closest;
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

            var closestHighway = await GetClosestHighway(request.LatLng);
            if (closestHighway == null)
            {
                throw new Exception("There's no close enough highway to add a gate");
            }
            var coordinate = request.LatLng.ToCoordinate();
            var closestNode = closestHighway.Geometry.Coordinates.OrderBy(n => n.Distance(coordinate)).FirstOrDefault();
            var closetNodeIndex = Array.FindIndex(closestHighway.Geometry.Coordinates.ToArray(), n => n == closestNode);
            if (closestNode.Distance(coordinate) < _options.ClosestNodeForGates
                || closetNodeIndex == 0 || closetNodeIndex == closestHighway.Geometry.Coordinates.Length - 1)
            {
                var nodeId = long.Parse(((List<object>)closestHighway.Attributes[FeatureAttributes.POI_OSM_NODES])[closetNodeIndex].ToString());
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

            // add in between two points:
            var segmentBefore = new LineSegment(closestHighway.Geometry.Coordinates[closetNodeIndex - 1], closestNode);
            var segmentAfter = new LineSegment(closestNode, closestHighway.Geometry.Coordinates[closetNodeIndex + 1]);
            var indexToInset = closetNodeIndex;
            if (segmentBefore.DistancePerpendicular(coordinate) < segmentAfter.DistancePerpendicular(coordinate))
            {
                indexToInset += 1;
            }
            
            return new OsmChange
            {
                Create = new[] { newNode },
                Modify = new[] { await AddNewNodeToExistingWay(osmGateway, closestHighway.GetOsmId(), indexToInset) }
            };
        }

        private async Task<Way> AddNewNodeToExistingWay(IAuthClient osmGateway, long wayId, int indexToInsert)
        {
            var simpleWay = await osmGateway.GetWay(wayId);
            var updatedList = simpleWay.Nodes.ToList();
            updatedList.Insert(indexToInsert, -1);
            simpleWay.Nodes = updatedList.ToArray();
            return simpleWay;
        }
    }
}
