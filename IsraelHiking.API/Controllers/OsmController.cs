using IsraelHiking.API.Executors;
using IsraelHiking.API.Gpx;
using IsraelHiking.API.Services;
using IsraelHiking.API.Services.Osm;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using NetTopologySuite.Features;
using NetTopologySuite.Geometries;
using NetTopologySuite.IO;
using OsmSharp.IO.API;
using ProjNet.CoordinateSystems.Transformations;
using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Threading.Tasks;
using GpxFile = NetTopologySuite.IO.GpxFile;

namespace IsraelHiking.API.Controllers;

/// <summary>
/// This controller is responsible for all OSM related requests
/// </summary>
[Route("api/[controller]")]
[Authorize]
public class OsmController : ControllerBase
{
    private readonly IClientsFactory _clientsFactory;
    private readonly IDataContainerConverterService _dataContainerConverterService;
    private readonly IAddibleGpxLinesFinderService _addibleGpxLinesFinderService;
    private readonly IOsmLineAdderService _osmLineAdderService;
    private readonly GeometryFactory _geometryFactory;
    private readonly MathTransform _itmWgs84MathTransform;
    private readonly MathTransform _wgs84ItmMathTransform;

    /// <summary>
    /// Controller's constructor
    /// </summary>
    /// <param name="clientsFactory"></param>
    /// <param name="dataContainerConverterService"></param>
    /// <param name="itmWgs84MathTransformFactory"></param>
    /// <param name="addibleGpxLinesFinderService"></param>
    /// <param name="osmLineAdderService"></param>
    /// <param name="geometryFactory"></param>
    public OsmController(IClientsFactory clientsFactory,
        IDataContainerConverterService dataContainerConverterService,
        IItmWgs84MathTransformFactory itmWgs84MathTransformFactory,
        IAddibleGpxLinesFinderService addibleGpxLinesFinderService,
        IOsmLineAdderService osmLineAdderService,
        GeometryFactory geometryFactory)
    {
        _clientsFactory = clientsFactory;
        _dataContainerConverterService = dataContainerConverterService;
        _itmWgs84MathTransform = itmWgs84MathTransformFactory.Create();
        _wgs84ItmMathTransform = itmWgs84MathTransformFactory.CreateInverse();
        _addibleGpxLinesFinderService = addibleGpxLinesFinderService;
        _osmLineAdderService = osmLineAdderService;
        _geometryFactory = geometryFactory;
    }

    /// <summary>
    /// Adds a missing route part to OSM
    /// </summary>
    /// <param name="feature"></param>
    /// <returns></returns>
    [HttpPut]
    public async Task PutAddUnmappedPartIntoOsm([FromBody]IFeature feature)
    {
        var tags = feature.Attributes.GetNames().ToDictionary(n => n, n => feature.Attributes[n].ToString());
        var gateway = OsmAuthFactoryWrapper.ClientFromUser(User, _clientsFactory);
        await _osmLineAdderService.Add(feature.Geometry as LineString, tags, gateway);
    }

    /// <summary>
    /// Finds unmapped parts of a given route
    /// </summary>
    /// <param name="traceId">The id of the osm trace</param>
    /// <returns></returns>
    [HttpPost]
    [ProducesResponseType(typeof(FeatureCollection), 200)]
    public async Task<IActionResult> PostFindUnmappedPartsFromGpsTrace([FromQuery]long traceId)
    {
        TypedStream file = null;
        try
        {
            file = await OsmAuthFactoryWrapper.ClientFromUser(User, _clientsFactory)
                .GetTraceData(traceId);
        }
        catch
        {
            // ignored
        }

        if (file == null)
        {
            return BadRequest("Invalid trace id: " + traceId);
        }

        await using var memoryStream = new MemoryStream();
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
        var attributesTable = new AttributesTable
        {
            {"highway", highwayType},
            {"source", "trace id: " + traceId}
        };
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
        waypointsGroups.AddRange((gpx.Routes ?? []).Select(route => route.Waypoints.ToArray()).Where(ps => ps.All(p => p.TimestampUtc.HasValue)).ToArray());
        waypointsGroups.AddRange((gpx.Tracks ?? []).Where(t => t.Segments != null).Select(track => track.Segments.SelectMany(s => s.Waypoints).ToArray()).Where(ps => ps.All(p => p.TimestampUtc.HasValue)));
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
        return (gpx.Routes ?? [])
            .Select(route => ToItmLineString(route.Waypoints))
            .Concat((gpx.Tracks ?? [])
                .Select(track => track.Segments.SelectMany(s => s.Waypoints))
                .Select(ToItmLineString))
            .Where(l => l.Coordinates.Any())
            .ToList();
    }
}