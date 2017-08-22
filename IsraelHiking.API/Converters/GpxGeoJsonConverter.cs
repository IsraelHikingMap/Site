using System.Collections.Generic;
using System.Linq;
using GeoAPI.Geometries;
using IsraelHiking.API.Gpx;
using NetTopologySuite.Features;
using NetTopologySuite.Geometries;
using NetTopologySuite.IO;

namespace IsraelHiking.API.Converters
{
    ///<inheritdoc />
    public class GpxGeoJsonConverter : IGpxGeoJsonConverter
    {
        private const string NAME = "name";
        private const string DESCRIPTIOM = "description";
        private const string CREATOR = "Creator";

        ///<inheritdoc />
        public FeatureCollection ToGeoJson(gpxType gpx)
        {
            var collection = new FeatureCollection();
            var points = gpx.wpt ?? new wptType[0];
            var pointsFeatures = points.Select(point => new Feature(new Point(CreateGeoPosition(point)), CreateProperties(point.name, point.desc)));
            pointsFeatures.ToList().ForEach(f => collection.Features.Add(f));

            var routes = gpx.rte ?? new rteType[0];
            var routesFeatures = routes.Select(route => new Feature(new LineString(route.rtept.Select(CreateGeoPosition).ToArray()), CreateProperties(route.name, route.desc)));
            routesFeatures.ToList().ForEach(f => collection.Features.Add(f));

            foreach (var track in gpx.trk ?? new trkType[0])
            {
                if (track.trkseg.Length == 1)
                {
                    var lineStringFeature = new Feature(new LineString(track.trkseg[0].trkpt.Select(CreateGeoPosition).ToArray()), CreateProperties(track.name, track.desc));
                    collection.Features.Add(lineStringFeature);
                    continue;
                }
                var lineStringList = track.trkseg.Select(segment => new LineString(segment.trkpt.Select(CreateGeoPosition).ToArray()) as ILineString).ToArray();
                var feature = new Feature(new MultiLineString(lineStringList), CreateMultiLineProperties(track.name, gpx.creator, track.desc));
                collection.Features.Add(feature);
            }
            return collection;
        }

        ///<inheritdoc />   
        public gpxType ToGpx(FeatureCollection collection)
        {
            return new gpxType
            {
                creator = collection.Features.FirstOrDefault(f => f.Attributes.GetNames().Contains(CREATOR))?.Attributes[CREATOR]?.ToString() ?? string.Empty,
                wpt = collection.Features.Where(f => f.Geometry is Point)
                    .Select(CreateWayPoint)
                    .Union(collection.Features.Where(f => f.Geometry is MultiPoint)
                        .SelectMany(CreateWayPointsFromMultiPoint))
                    .ToArray(),
                rte = collection.Features.Where(f => f.Geometry is LineString)
                    .Select(CreateRouteFromLineString)
                    .Union(collection.Features.Where(f => f.Geometry is Polygon).Select(CreateRouteFromPolygon))
                    .Union(collection.Features.Where(f => f.Geometry is MultiPolygon).SelectMany(CreateRoutesFromMultiPolygon))
                    .ToArray(),
                trk = collection.Features.Where(f => f.Geometry is MultiLineString)
                    .SelectMany(CreateTracksFromMultiLineString)
                    .ToArray()
            }.UpdateBounds();
        }

        private Coordinate CreateGeoPosition(wptType wayPoint)
        {
            double lat = (double)wayPoint.lat;
            double lon = (double)wayPoint.lon;
            return wayPoint.eleSpecified ? new Coordinate(lon, lat, (double)wayPoint.ele) : new Coordinate(lon, lat);
        }

        private wptType CreateWayPoint(IFeature pointFeature)
        {
            var point = (Point)pointFeature.Geometry;
            var position = point.Coordinate;
            return CreateWayPoint(position, GetFeatureName(pointFeature), GetFeatureDescription(pointFeature));
        }

        private wptType[] CreateWayPointsFromMultiPoint(IFeature pointFeature)
        {
            var multiPoint = (MultiPoint)pointFeature.Geometry;
            var positions = multiPoint.Coordinates;
            return positions.Select(p => CreateWayPoint(p, GetFeatureName(pointFeature), GetFeatureDescription(pointFeature))).ToArray();
        }

        private wptType CreateWayPoint(Coordinate position, string name, string description)
        {
            return new wptType
            {
                lon = (decimal)position.X,
                lat = (decimal)position.Y,
                ele = (decimal)(double.IsNaN(position.Z) ? 0 : position.Z),
                eleSpecified = double.IsNaN(position.Z),
                name = name,
                desc = description
            };
        }

        private rteType CreateRouteFromLineString(IFeature lineStringFeature)
        {
            var lineString = (LineString)lineStringFeature.Geometry;

            return new rteType
            {
                name = GetFeatureName(lineStringFeature),
                desc = GetFeatureDescription(lineStringFeature),
                rtept = lineString?.Coordinates.Select(p => CreateWayPoint(p, null, null)).ToArray()

            };
        }
        private rteType CreateRouteFromPolygon(IFeature lineStringFeature)
        {
            var polygon = (Polygon)lineStringFeature.Geometry;

            return new rteType
            {
                name = GetFeatureName(lineStringFeature),
                desc = GetFeatureDescription(lineStringFeature),
                rtept = polygon?.Coordinates.Select(p => CreateWayPoint(p, null, null)).ToArray()
            };
        }

        private trkType[] CreateTracksFromMultiLineString(IFeature multiLineStringFeature)
        {
            var multiLineString = multiLineStringFeature.Geometry as MultiLineString;
            if (multiLineString == null)
            {
                return new trkType[0];
            }
            var name = GetFeatureName(multiLineStringFeature);
            var description = GetFeatureDescription(multiLineStringFeature);
            var tracks = new List<trkType>();
            var currentTrack = new trkType { name = name, desc = description, trkseg = new trksegType[0]};
            foreach (var lineString in multiLineString.Geometries.OfType<ILineString>().Where(ls => ls.Coordinates.Any()))
            {
                var currentSegment = new trksegType
                {
                    trkpt = lineString.Coordinates.Select(p => CreateWayPoint(p, null, null)).ToArray()
                };
                if (currentTrack.trkseg.Length == 0)
                {
                    currentTrack.trkseg = new[] {currentSegment};
                    continue;
                }
                var lastPointInTrack = currentTrack.trkseg.Last().trkpt.Last();
                var firstPointInSegment = currentSegment.trkpt.First();
                if (lastPointInTrack.lat == firstPointInSegment.lat && lastPointInTrack.lon == firstPointInSegment.lon)
                {
                    var list = currentTrack.trkseg.ToList();
                    list.Add(currentSegment);
                    currentTrack.trkseg = list.ToArray();
                }
                else
                {
                    // need to start a new track.
                    tracks.Add(currentTrack);
                    currentTrack = new trkType {name = name, desc = description, trkseg = new[] {currentSegment}};
                }
            }
            tracks.Add(currentTrack);
            return tracks.ToArray();
        }

        private rteType[] CreateRoutesFromMultiPolygon(IFeature multiPolygonFeature)
        {
            var multiPolygon = multiPolygonFeature.Geometry as MultiPolygon;
            if (multiPolygon == null)
            {
                return new rteType[0];
            }
            return multiPolygon.Geometries.OfType<Polygon>().Select(
                p => new rteType
                {
                    rtept = p.Coordinates.Select(c => CreateWayPoint(c, null, null)).ToArray(),
                    name = GetFeatureName(multiPolygonFeature),
                    desc = GetFeatureDescription(multiPolygonFeature)
                }).ToArray();
        }

        private IAttributesTable CreateProperties(string name, string description)
        {
            var table = new AttributesTable();
            table.AddAttribute(NAME, name);
            table.AddAttribute(DESCRIPTIOM, description);
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
            return feature.Attributes.GetNames().Contains(NAME) ? feature.Attributes[NAME]?.ToString() : string.Empty;
        }

        private string GetFeatureDescription(IFeature feature)
        {
            return feature.Attributes.GetNames().Contains(DESCRIPTIOM) ? feature.Attributes[DESCRIPTIOM]?.ToString() : string.Empty;
        }
    }
}
