using System.Linq;
using GeoAPI.Geometries;
using IsraelHiking.API.Gpx.GpxTypes;
using IsraelHiking.Common;
using NetTopologySuite.Features;
using NetTopologySuite.Geometries;

namespace IsraelHiking.API.Converters
{
    public class GpxGeoJsonConverter : IGpxGeoJsonConverter
    {
        private const string NAME = "name";

        public FeatureCollection ToGeoJson(gpxType gpx)
        {
            var collection = new FeatureCollection();
            var points = gpx.wpt ?? new wptType[0];
            var pointsFeatures = points.Select(point => new Feature(new Point(CreateGeoPosition(point)), CreateNameProperties(point.name)));
            pointsFeatures.ToList().ForEach(f => collection.Features.Add(f));

            var routes = gpx.rte ?? new rteType[0];
            var routesFeatures = routes.Select(route => new Feature(new LineString(route.rtept.Select(CreateGeoPosition).ToArray()), CreateNameProperties(route.name)));
            routesFeatures.ToList().ForEach(f => collection.Features.Add(f));

            foreach (var track in gpx.trk ?? new trkType[0])
            {
                if (track.trkseg.Length == 1)
                {
                    var lineStringFeature = new Feature(new LineString(track.trkseg[0].trkpt.Select(CreateGeoPosition).ToArray()), CreateNameProperties(track.name));
                    collection.Features.Add(lineStringFeature);
                    continue;
                }
                var lineStringList = track.trkseg.Select(segment => new LineString(segment.trkpt.Select(CreateGeoPosition).ToArray()) as ILineString).ToArray();
                var feature = new Feature(new MultiLineString(lineStringList), CreateMultiLineProperties(track.name));
                collection.Features.Add(feature);
            }
            return collection;        
        }

        public gpxType ToGpx(FeatureCollection collection)
        {
            return new gpxType
            {
                creator = DataContainer.ISRAEL_HIKING_MAP,
                wpt = collection.Features.Where(f => f.Geometry is Point).Select(CreateWayPoint).ToArray(),
                rte = collection.Features.Where(f => f.Geometry is LineString).Select(CreateRoute).ToArray(),
                trk = collection.Features.Where(f => f.Geometry is MultiLineString).Select(CreateTrack).ToArray(),
            };
        }

        private Coordinate CreateGeoPosition(wptType wayPoint)
        {
            double lat = (double)wayPoint.lat;
            double lon = (double)wayPoint.lon;
            return wayPoint.eleSpecified ? new Coordinate(lon, lat, (double)wayPoint.ele) : new Coordinate(lon, lat);
        }

        private wptType CreateWayPoint(IFeature pointFeature)
        {
            var point = (Point) pointFeature.Geometry;
            var position = point.Coordinate;
            return CreateWayPoint(position, GetFeatureName(pointFeature));
        }

        private wptType CreateWayPoint(Coordinate position, string name)
        {
            return new wptType
            {
                lon = (decimal)position.X,
                lat = (decimal)position.Y,
                ele = (decimal)(double.IsNaN(position.Z) ? 0 : position.Z),
                eleSpecified = double.IsNaN(position.Z),
                name = name
            };
        }

        private rteType CreateRoute(IFeature lineStringFeature)
        {
            var lineString = lineStringFeature.Geometry as LineString;

            return new rteType
            {
                name = GetFeatureName(lineStringFeature),
                rtept = lineString?.Coordinates.Select(p => CreateWayPoint(p, null)).ToArray()
                
            };
        }

        private trkType CreateTrack(IFeature multiLineStringFeature)
        {
            var multiLineString = multiLineStringFeature.Geometry as MultiLineString;
            return new trkType
            {
                name = GetFeatureName(multiLineStringFeature),
                trkseg = multiLineString?.Geometries.OfType<ILineString>().Select(
                    ls => new trksegType
                    {
                        trkpt = ls.Coordinates.Select(p => CreateWayPoint(p, null))
                            .ToArray()
                    }).ToArray()
            };
        }

        private IAttributesTable CreateNameProperties(string name)
        {
            var table = new AttributesTable();
            table.AddAttribute(NAME, name);
            return table;
        }

        private IAttributesTable CreateMultiLineProperties(string name)
        {
            var table = CreateNameProperties(name);
            table.AddAttribute("Creator", DataContainer.ISRAEL_HIKING_MAP);
            return table;
        }

        private string GetFeatureName(IFeature feature)
        {
            return feature.Attributes.GetNames().Contains(NAME) ? feature.Attributes[NAME].ToString() : string.Empty;
        }
    }
}
