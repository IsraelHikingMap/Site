using IsraelHiking.API.Gpx;
using NetTopologySuite.Features;
using NetTopologySuite.Geometries;
using NetTopologySuite.IO;
using System.Collections.Generic;
using System.Collections.Immutable;
using System.Linq;

namespace IsraelHiking.API.Converters;

///<inheritdoc />
public class GpxGeoJsonConverter : IGpxGeoJsonConverter
{
    private const string NAME = "name";
    private const string DESCRIPTION = "description";
    private const string CREATOR = "Creator";

    private readonly GeometryFactory _geometryFactory;
    /// <summary>
    /// Constructor
    /// </summary>
    /// <param name="geometryFactory"></param>

    public GpxGeoJsonConverter(GeometryFactory geometryFactory)
    {
        _geometryFactory = geometryFactory;
    }

    ///<inheritdoc />
    public FeatureCollection ToGeoJson(GpxFile gpx)
    {
        var collection = new FeatureCollection();
        var points = gpx.Waypoints ?? [];
        var pointsFeatures = points.Select(point => new Feature(_geometryFactory.CreatePoint(CreateGeoPosition(point)), CreateProperties(point.Name, point.Description)));
        pointsFeatures.ToList().ForEach(f => collection.Add(f));

        var routes = gpx.Routes ?? [];
        var routesFeatures = routes.Select(route => new Feature(CreateLineSringFromWaypoints(route.Waypoints), CreateProperties(route.Name, route.Description)));
        routesFeatures.ToList().ForEach(f => collection.Add(f));

        foreach (var track in gpx.Tracks ?? [])
        {
            if (track.Segments.Length == 1)
            {
                if (track.Segments.First().Waypoints.Count <= 1)
                {
                    continue;
                }
                var lineStringFeature = new Feature(CreateLineSringFromWaypoints(track.Segments.First().Waypoints), CreateProperties(track.Name, track.Description));
                if (lineStringFeature.Geometry != null)
                {
                    collection.Add(lineStringFeature);
                }
                continue;
            }
            var feature = new Feature(CreateLinesFromSegments(track.Segments), CreateMultiLineProperties(track.Name, gpx.Metadata.Creator, track.Description));
            if (feature.Geometry != null)
            {
                collection.Add(feature);
            }
        }
        return collection;
    }

    ///<inheritdoc />   
    public GpxFile ToGpx(FeatureCollection collection)
    {
        var gpx = new GpxFile
        {
            Metadata = new GpxMetadata(collection.FirstOrDefault(f => f.Attributes.Exists(CREATOR))
                ?.Attributes[CREATOR]?.ToString() ?? GpxDataContainerConverter.MAPEAK + "_geojson")
        };
        gpx.Waypoints.AddRange(collection.Where(f => f.Geometry is Point)
            .Select(CreateWaypoint)
            .Union(collection.Where(f => f.Geometry is MultiPoint)
                .SelectMany(CreateWayPointsFromMultiPoint))
            .ToList());
        gpx.Routes.AddRange(collection.Where(f => f.Geometry is LineString)
            .Select(CreateRouteFromLineString)
            .Union(collection.Where(f => f.Geometry is Polygon).Select(CreateRouteFromPolygon))
            .Union(collection.Where(f => f.Geometry is MultiPolygon)
                .SelectMany(CreateRoutesFromMultiPolygon))
            .ToList());
        gpx.Tracks.AddRange(collection.Where(f => f.Geometry is MultiLineString)
            .SelectMany(CreateTracksFromMultiLineString)
            .ToList());
        gpx.UpdateBounds();
        return gpx;
    }

    private Coordinate CreateGeoPosition(GpxWaypoint waypoint)
    {
        double lat = waypoint.Latitude;
        double lon = waypoint.Longitude;
        return waypoint.ElevationInMeters.HasValue 
            ? new CoordinateZ(lon, lat, (double)waypoint.ElevationInMeters)
            : new CoordinateZ(lon, lat, double.NaN);
    }

    private LineString CreateLineSringFromWaypoints(ImmutableGpxWaypointTable waypoints)
    {
        var coordinates = waypoints.Select(CreateGeoPosition).ToList();
        return CreateLineStringFromCoordinates(coordinates);
            
    }

    private LineString CreateLineStringFromCoordinates(List<Coordinate> coordinates)
    {
        for (var coordinateIndex = coordinates.Count - 1; coordinateIndex > 0; coordinateIndex--)
        {
            if (coordinates[coordinateIndex].Equals2D(coordinates[coordinateIndex - 1]))
            {
                coordinates.RemoveAt(coordinateIndex);
            }
        }
        if (coordinates.Count == 1)
        {
            return null;
        }
        return _geometryFactory.CreateLineString(coordinates.ToArray());
    }

    private Geometry CreateLinesFromSegments(ImmutableArray<GpxTrackSegment> segments)
    {
        var coordinatesGroups = segments.Select(s => s.Waypoints.Select(CreateGeoPosition).ToArray()).ToList();
        for (var groupIndex = coordinatesGroups.Count - 1; groupIndex > 0; groupIndex--)
        {
            if (coordinatesGroups[groupIndex].First().Equals2D(coordinatesGroups[groupIndex - 1].Last()))
            {
                coordinatesGroups[groupIndex - 1] = coordinatesGroups[groupIndex - 1].Concat(coordinatesGroups[groupIndex].Skip(1)).ToArray();
                coordinatesGroups.RemoveAt(groupIndex);
            }
        }
        return coordinatesGroups.Count > 1
            ? _geometryFactory.CreateMultiLineString(
                coordinatesGroups.Select(g => CreateLineStringFromCoordinates(g.ToList())).Where(l => l != null).ToArray())
            : CreateLineStringFromCoordinates(coordinatesGroups.First().ToList());
    }

    private GpxWaypoint CreateWaypoint(IFeature pointFeature)
    {
        var point = (Point)pointFeature.Geometry;
        var position = point.Coordinate;
        return CreateWaypoint(position, GetFeatureName(pointFeature), GetFeatureDescription(pointFeature));
    }

    private GpxWaypoint[] CreateWayPointsFromMultiPoint(IFeature pointFeature)
    {
        var multiPoint = (MultiPoint)pointFeature.Geometry;
        var positions = multiPoint.Coordinates;
        return positions.Select(p => CreateWaypoint(p, GetFeatureName(pointFeature), GetFeatureDescription(pointFeature))).ToArray();
    }

    private GpxWaypoint CreateWaypoint(Coordinate position, string name, string description)
    {
        return new GpxWaypoint(
            longitude: new GpxLongitude(position.X),
            latitude: new GpxLatitude(position.Y), 
            elevationInMeters: double.IsNaN(position.Z) ? null : position.Z,
            name: name,
            description: description,
            links: ImmutableArray<GpxWebLink>.Empty, 
            classification: null,
            extensions: null,
            timestampUtc: null,
            symbolText: null,
            magneticVariation: null,
            geoidHeight: null,
            comment: null,
            source: null,
            fixKind: null,
            numberOfSatellites: null,
            horizontalDilutionOfPrecision: null,
            verticalDilutionOfPrecision: null,
            positionDilutionOfPrecision: null,
            secondsSinceLastDgpsUpdate: null,
            dgpsStationId: null
        );
    }

    private GpxRoute CreateRouteFromLineString(IFeature lineStringFeature)
    {
        var lineString = (LineString)lineStringFeature.Geometry;

        return new GpxRoute(
            name: GetFeatureName(lineStringFeature),
            description: GetFeatureDescription(lineStringFeature),
            waypoints: new ImmutableGpxWaypointTable(lineString?.Coordinates.Select(p => CreateWaypoint(p, null, null))),
            comment: null, source: null, links: ImmutableArray<GpxWebLink>.Empty, number: null,
            classification: null, extensions: null
        );
    }
    private GpxRoute CreateRouteFromPolygon(IFeature lineStringFeature)
    {
        var polygon = (Polygon)lineStringFeature.Geometry;

        return new GpxRoute(
            name: GetFeatureName(lineStringFeature),
            description: GetFeatureDescription(lineStringFeature),
            waypoints: new ImmutableGpxWaypointTable(polygon?.Coordinates.Select(p => CreateWaypoint(p, null, null))),
            comment: null, source: null, links: ImmutableArray<GpxWebLink>.Empty, number: null,
            classification: null, extensions: null
        );
    }

    private GpxTrack[] CreateTracksFromMultiLineString(IFeature multiLineStringFeature)
    {
        var multiLineString = multiLineStringFeature.Geometry as MultiLineString;
        if (multiLineString == null)
        {
            return [];
        }
        var name = GetFeatureName(multiLineStringFeature);
        var description = GetFeatureDescription(multiLineStringFeature);
        var tracks = new List<GpxTrack>();
        var nameIndex = 0;
        var list = new List<GpxTrackSegment>();
        foreach (var lineString in multiLineString.Geometries.OfType<LineString>().Where(ls => ls.Coordinates.Any()))
        {
            var currentSegment =
                new GpxTrackSegment(
                    new ImmutableGpxWaypointTable(
                        lineString.Coordinates.Select(p => CreateWaypoint(p, null, null))), null);
            if (list.Count == 0)
            {
                list.Add(currentSegment);
                continue;
            }
            var lastPointInTrack = list.Last().Waypoints.Last();
            var firstPointInSegment = currentSegment.Waypoints.First();
            if (lastPointInTrack.Latitude.Equals(firstPointInSegment.Latitude) && 
                lastPointInTrack.Longitude.Equals(firstPointInSegment.Longitude))
            {
                list.Add(currentSegment);
            }
            else
            {
                // need to start a new track.
                var trackName = nameIndex == 0 ? name : name + " " + nameIndex;
                var newTrack = new GpxTrack(name: trackName, description: description,
                    segments: [..list], classification: null, comment: null, source: null,
                    links: ImmutableArray<GpxWebLink>.Empty, extensions: null, number: null);
                tracks.Add(newTrack);
                list.Clear();
                list.Add(currentSegment);
                nameIndex++;
            }
        }
        var lastTackName = nameIndex == 0 ? name : name + " " + nameIndex;
        var lastTrack = new GpxTrack(name: lastTackName, description: description,
            segments: [..list], classification: null, comment: null, source: null,
            links: ImmutableArray<GpxWebLink>.Empty, extensions: null, number: null);
        tracks.Add(lastTrack);
        return tracks.ToArray();
    }

    private GpxRoute[] CreateRoutesFromMultiPolygon(IFeature multiPolygonFeature)
    {
        var multiPolygon = multiPolygonFeature.Geometry as MultiPolygon;
        if (multiPolygon == null)
        {
            return [];
        }
        return multiPolygon.Geometries.OfType<Polygon>().Select(
            p => new GpxRoute(
                name: GetFeatureName(multiPolygonFeature),
                description: GetFeatureDescription(multiPolygonFeature),
                waypoints: new ImmutableGpxWaypointTable(p.Coordinates.Select(c => CreateWaypoint(c, null, null))),
                extensions: null,
                comment: null,
                source: null,
                links: ImmutableArray<GpxWebLink>.Empty, 
                number: null,
                classification: null)
        ).ToArray();
    }

    private IAttributesTable CreateProperties(string name, string description)
    {
        var table = new AttributesTable {{NAME, name}, {DESCRIPTION, description}};
        return table;
    }

    private IAttributesTable CreateMultiLineProperties(string name, string creator, string description)
    {
        var table = CreateProperties(name, description);
        table.Add(CREATOR, creator);
        return table;
    }

    private string GetFeatureName(IFeature feature)
    {
        return feature.Attributes.Exists(NAME) ? feature.Attributes[NAME]?.ToString() : string.Empty;
    }

    private string GetFeatureDescription(IFeature feature)
    {
        return feature.Attributes.Exists(DESCRIPTION) ? feature.Attributes[DESCRIPTION]?.ToString() : string.Empty;
    }
}