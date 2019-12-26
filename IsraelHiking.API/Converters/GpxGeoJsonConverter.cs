using GeoAPI.Geometries;
using IsraelHiking.API.Gpx;
using NetTopologySuite.Features;
using NetTopologySuite.Geometries;
using NetTopologySuite.IO;
using System.Collections.Generic;
using System.Collections.Immutable;
using System.Linq;

namespace IsraelHiking.API.Converters
{
    ///<inheritdoc />
    public class GpxGeoJsonConverter : IGpxGeoJsonConverter
    {
        private const string NAME = "name";
        private const string DESCRIPTIOM = "description";
        private const string CREATOR = "Creator";

        ///<inheritdoc />
        public FeatureCollection ToGeoJson(GpxFile gpx)
        {
            var collection = new FeatureCollection();
            var points = gpx.Waypoints ?? new List<GpxWaypoint>();
            var pointsFeatures = points.Select(point => new Feature(new Point(CreateGeoPosition(point)), CreateProperties(point.Name, point.Description)));
            pointsFeatures.ToList().ForEach(f => collection.Add(f));

            var routes = gpx.Routes ?? new List<GpxRoute>();
            var routesFeatures = routes.Select(route => new Feature(new LineString(route.Waypoints.Select(CreateGeoPosition).ToArray()), CreateProperties(route.Name, route.Description)));
            routesFeatures.ToList().ForEach(f => collection.Add(f));

            foreach (var track in gpx.Tracks ?? new List<GpxTrack>())
            {
                if (track.Segments.Length == 1)
                {
                    var lineStringFeature = new Feature(new LineString(track.Segments[0].Waypoints.Select(CreateGeoPosition).ToArray()), CreateProperties(track.Name, track.Description));
                    collection.Add(lineStringFeature);
                    continue;
                }
                var lineStringList = track.Segments.Select(segment => new LineString(segment.Waypoints.Select(CreateGeoPosition).ToArray()) as LineString).ToArray();
                var feature = new Feature(new MultiLineString(lineStringList), CreateMultiLineProperties(track.Name, gpx.Metadata.Creator, track.Description));
                collection.Add(feature);
            }
            return collection;
        }

        ///<inheritdoc />   
        public GpxFile ToGpx(FeatureCollection collection)
        {
            var gpx = new GpxFile
            {
                Metadata = new GpxMetadata(collection.Features.FirstOrDefault(f => f.Attributes.Exists(CREATOR))
                                               ?.Attributes[CREATOR]?.ToString() ?? GpxDataContainerConverter.ISRAEL_HIKING_MAP + "_geojson")
            };
            gpx.Waypoints.AddRange(collection.Features.Where(f => f.Geometry is Point)
                .Select(CreateWaypoint)
                .Union(collection.Features.Where(f => f.Geometry is MultiPoint)
                    .SelectMany(CreateWayPointsFromMultiPoint))
                .ToList());
            gpx.Routes.AddRange(collection.Features.Where(f => f.Geometry is LineString)
                .Select(CreateRouteFromLineString)
                .Union(collection.Features.Where(f => f.Geometry is Polygon).Select(CreateRouteFromPolygon))
                .Union(collection.Features.Where(f => f.Geometry is MultiPolygon)
                    .SelectMany(CreateRoutesFromMultiPolygon))
                .ToList());
            gpx.Tracks.AddRange(collection.Features.Where(f => f.Geometry is MultiLineString)
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
                ? new Coordinate(lon, lat, (double)waypoint.ElevationInMeters)
                : new Coordinate(lon, lat, double.NaN);
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
                elevationInMeters: double.IsNaN(position.Z) ? (double?)null : position.Z,
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
                return new GpxTrack[0];
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
                        segments: list.ToImmutableArray(), classification: null, comment: null, source: null,
                        links: ImmutableArray<GpxWebLink>.Empty, extensions: null, number: null);
                    tracks.Add(newTrack);
                    list.Clear();
                    list.Add(currentSegment);
                    nameIndex++;
                }
            }
            var lastTackName = nameIndex == 0 ? name : name + " " + nameIndex;
            var lastTrack = new GpxTrack(name: lastTackName, description: description,
                segments: list.ToImmutableArray(), classification: null, comment: null, source: null,
                links: ImmutableArray<GpxWebLink>.Empty, extensions: null, number: null);
            tracks.Add(lastTrack);
            return tracks.ToArray();
        }

        private GpxRoute[] CreateRoutesFromMultiPolygon(IFeature multiPolygonFeature)
        {
            var multiPolygon = multiPolygonFeature.Geometry as MultiPolygon;
            if (multiPolygon == null)
            {
                return new GpxRoute[0];
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
            var table = new AttributesTable {{NAME, name}, {DESCRIPTIOM, description}};
            return table;
        }

        private IAttributesTable CreateMultiLineProperties(string name, string creator, string description)
        {
            var table = CreateProperties(name, description);
            table.AddAttribute(CREATOR, creator);
            return table;
        }

        private string GetFeatureName(IFeature feature)
        {
            return feature.Attributes.Exists(NAME) ? feature.Attributes[NAME]?.ToString() : string.Empty;
        }

        private string GetFeatureDescription(IFeature feature)
        {
            return feature.Attributes.Exists(DESCRIPTIOM) ? feature.Attributes[DESCRIPTIOM]?.ToString() : string.Empty;
        }
    }
}
