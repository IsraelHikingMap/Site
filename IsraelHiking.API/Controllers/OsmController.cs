﻿using IsraelHiking.API.Executors;
using IsraelHiking.API.Gpx;
using IsraelHiking.API.Services;
using IsraelHiking.API.Services.Osm;
using IsraelHiking.Common.Configuration;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Options;
using NetTopologySuite.Features;
using NetTopologySuite.Geometries;
using NetTopologySuite.IO;
using OsmSharp.API;
using OsmSharp.IO.API;
using ProjNet.CoordinateSystems.Transformations;
using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Threading.Tasks;
using IsraelHiking.Common;
using GpxFile = NetTopologySuite.IO.GpxFile;

namespace IsraelHiking.API.Controllers
{
    /// <summary>
    /// This controller is responsible for all OSM related requests
    /// </summary>
    [Route("api/[controller]")]
    public class OsmController : ControllerBase
    {
        private readonly IClientsFactory _clentsFactory;
        private readonly IDataContainerConverterService _dataContainerConverterService;
        private readonly IAddibleGpxLinesFinderService _addibleGpxLinesFinderService;
        private readonly IOsmLineAdderService _osmLineAdderService;
        private readonly GeometryFactory _geometryFactory;
        private readonly ConfigurationData _options;
        private readonly MathTransform _itmWgs84MathTransform;
        private readonly MathTransform _wgs84ItmMathTransform;

        /// <summary>
        /// Controller's constructor
        /// </summary>
        /// <param name="clentsFactory"></param>
        /// <param name="dataContainerConverterService"></param>
        /// <param name="itmWgs84MathTransfromFactory"></param>
        /// <param name="addibleGpxLinesFinderService"></param>
        /// <param name="osmLineAdderService"></param>
        /// <param name="options"></param>
        /// <param name="geometryFactory"></param>
        public OsmController(IClientsFactory clentsFactory,
            IDataContainerConverterService dataContainerConverterService,
            IItmWgs84MathTransfromFactory itmWgs84MathTransfromFactory,
            IAddibleGpxLinesFinderService addibleGpxLinesFinderService,
            IOsmLineAdderService osmLineAdderService,
            IOptions<ConfigurationData> options,
            GeometryFactory geometryFactory)
        {
            _clentsFactory = clentsFactory;
            _dataContainerConverterService = dataContainerConverterService;
            _itmWgs84MathTransform = itmWgs84MathTransfromFactory.Create();
            _wgs84ItmMathTransform = itmWgs84MathTransfromFactory.CreateInverse();
            _addibleGpxLinesFinderService = addibleGpxLinesFinderService;
            _osmLineAdderService = osmLineAdderService;
            _options = options.Value;
            _geometryFactory = geometryFactory;
        }

        /// <summary>
        /// Get the OSM server configuration
        /// </summary>
        /// <returns>The OSM server configurations</returns>
        [HttpGet]
        [Route("configuration")]
        public OsmConfiguraionData GetConfigurations()
        {
            return _options.OsmConfiguration;
        }

        /// <summary>
        /// Used to get user details from OSM
        /// </summary>
        /// <returns></returns>
        [HttpGet]
        [Route("details")]
        public Task<User> GetUserDetails()
        {
            var gateway = CreateOsmGateway();
            return gateway.GetUserDetails();
        }

        /// <summary>
        /// Adds a missing route part to OSM
        /// </summary>
        /// <param name="feature"></param>
        /// <returns></returns>
        [Authorize]
        [HttpPut]
        public async Task PutAddUnmappedPartIntoOsm([FromBody]Feature feature)
        {
            var tags = feature.Attributes.GetNames().ToDictionary(n => n, n => feature.Attributes[n].ToString());
            var tokenAndSecret = User.Claims.FirstOrDefault(c => c.Type == TokenAndSecret.CLAIM_KEY)?.Value;
            await _osmLineAdderService.Add(feature.Geometry as LineString, tags, TokenAndSecret.FromString(tokenAndSecret));
        }

        /// <summary>
        /// Finds unmapped parts of a given route
        /// </summary>
        /// <param name="traceId">The id of the osm trace</param>
        /// <returns></returns>
        [HttpPost]
        [ProducesResponseType(typeof(FeatureCollection), 200)]
        public async Task<IActionResult> PostFindUnmappedPartsFromGpsTrace([FromQuery]int traceId)
        {
            var file = await CreateOsmGateway().GetTraceData(traceId);
            if (file == null)
            {
                return BadRequest("Invalid trace id: " + traceId);
            }
            using var memoryStream = new MemoryStream();
            await file.Stream.CopyToAsync(memoryStream);
            var gpxBytes = await _dataContainerConverterService.Convert(memoryStream.ToArray(), file.FileName, DataContainerConverterService.GPX);
            var gpx = gpxBytes.ToGpx().UpdateBounds();
            var highwayType = GetHighwayType(gpx);
            var gpxItmLines = GpxToItmLineStrings(gpx);
            if (!gpxItmLines.Any())
            {
                return BadRequest("File does not contain any traces...");
            }
            var manipulatedItmLines = await _addibleGpxLinesFinderService.GetLines(gpxItmLines);
            var attributesTable = new AttributesTable { { "highway", highwayType } };
            attributesTable.Add("source", "trace id: " + traceId);
            var featureCollection = new FeatureCollection();
            foreach (var line in manipulatedItmLines)
            {
                featureCollection.Add(new Feature(ToWgs84LineString(line.Coordinates), attributesTable));
            }
            return Ok(featureCollection);
        }

        private string GetHighwayType(GpxFile gpx)
        {
            var waypointsGroups = new List<GpxWaypoint[]>();
            waypointsGroups.AddRange((gpx.Routes ?? new List<GpxRoute>()).Select(route => route.Waypoints.ToArray()).Where(ps => ps.All(p => p.TimestampUtc.HasValue)).ToArray());
            waypointsGroups.AddRange((gpx.Tracks ?? new List<GpxTrack>()).Where(t => t.Segments != null).Select(track => track.Segments.SelectMany(s => s.Waypoints).ToArray()).Where(ps => ps.All(p => p.TimestampUtc.HasValue)));
            return GetHighwayTypeFromWaypoints(waypointsGroups);
        }

        /// <summary>
        /// Determines routing type by calculating the average speed of each set of points.
        /// Assuming all the point sent has time specified.
        /// </summary>
        /// <param name="waypointsGoups">A list of group of points</param>
        /// <returns>The calculated routing type</returns>
        private string GetHighwayTypeFromWaypoints(IReadOnlyCollection<GpxWaypoint[]> waypointsGoups)
        {
            var velocityList = new List<double>();
            if (waypointsGoups.Count == 0)
            {
                return "track";
            }
            foreach (var waypoints in waypointsGoups.Where(g => g.Length > 1))
            {
                var lengthInKm = ToItmLineString(waypoints).Length / 1000;
                var timeInHours = (waypoints.Last().TimestampUtc.Value - waypoints.First().TimestampUtc.Value).TotalHours;
                velocityList.Add(lengthInKm / timeInHours);
            }
            var averageVelocity = velocityList.Sum() / velocityList.Count;
            if (averageVelocity <= 6)
            {
                return "footway";
            }
            if (averageVelocity <= 12)
            {
                return "cycleway";
            }
            return "track";
        }

        private LineString ToItmLineString(IEnumerable<GpxWaypoint> waypoints)
        {
            var coordinates = waypoints.Select(waypoint => _wgs84ItmMathTransform.Transform(waypoint.Longitude, waypoint.Latitude))
                .Select(c => new Coordinate(Math.Round(c.x, 1), Math.Round(c.y, 1)));
            var nonDuplicates = new List<Coordinate>();
            foreach (var coordinate in coordinates)
            {
                if (nonDuplicates.Count <= 0 || !nonDuplicates.Last().Equals2D(coordinate))
                {
                    nonDuplicates.Add(coordinate);
                }
            }
            return _geometryFactory.CreateLineString(nonDuplicates.ToArray());
        }

        private LineString ToWgs84LineString(IEnumerable<Coordinate> coordinates)
        {
            var wgs84Coordinates = coordinates.Select(c => _itmWgs84MathTransform.Transform(c.X, c.Y)).Select(c => new Coordinate(c.x, c.y));
            var nonDuplicates = new List<Coordinate>();
            foreach (var coordinate in wgs84Coordinates)
            {
                if (nonDuplicates.Count <= 0 || !nonDuplicates.Last().Equals2D(coordinate))
                {
                    nonDuplicates.Add(coordinate);
                }
            }
            return _geometryFactory.CreateLineString(nonDuplicates.ToArray());
        }

        private List<LineString> GpxToItmLineStrings(GpxFile gpx)
        {
            return (gpx.Routes ?? new List<GpxRoute>())
                .Select(route => ToItmLineString(route.Waypoints))
                .Concat((gpx.Tracks ?? new List<GpxTrack>())
                    .Select(track => track.Segments.SelectMany(s => s.Waypoints))
                    .Select(ToItmLineString))
                .Where(l => l.Coordinates.Any())
                .ToList();
        }

        private IAuthClient CreateOsmGateway()
        {
            var tokenAndSecret = User.Claims.FirstOrDefault(c => c.Type == TokenAndSecret.CLAIM_KEY)?.Value;
            var token = TokenAndSecret.FromString(tokenAndSecret);
            return _clentsFactory.CreateOAuthClient(_options.OsmConfiguration.ConsumerKey, _options.OsmConfiguration.ConsumerSecret, token.Token, token.TokenSecret);
        }
    }
}
