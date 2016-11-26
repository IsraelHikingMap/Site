using System;
using System.Collections.Generic;
using System.Collections.ObjectModel;
using System.IO;
using System.Linq;
using System.Threading.Tasks;
using System.Web.Http;
using GeoAPI.Geometries;
using IsraelHiking.API.Converters;
using IsraelHiking.API.Gpx;
using IsraelHiking.API.Gpx.GpxTypes;
using IsraelHiking.API.Services;
using IsraelHiking.Common;
using IsraelHiking.DataAccessInterfaces;
using IsraelTransverseMercator;
using NetTopologySuite.Features;
using NetTopologySuite.Geometries;
using OsmSharp.Osm;

namespace IsraelHiking.API.Controllers
{
    public class OsmController : ApiController
    {
        private const double CLOSEST_POINT_TOLERANCE = 30; // meters
        private const double MINIMAL_MISSING_PART_LENGTH = 200; // meters
        private const double ANGLE_VARIATION = 30; // degrees

        private readonly IOverpassGateway _overpassGateway;
        private readonly IOsmGeoJsonConverter _osmGeoJsonConverter;
        private readonly IRemoteFileFetcherGateway _remoteFileFetcherGateway;
        private readonly IDataContainerConverterService _dataContainerConverterService;
        private readonly IDouglasPeuckerReductionService _douglasPeuckerReductionService;
        private readonly ICoordinatesConverter _coordinatesConverter;

        public OsmController(IOverpassGateway overpassGateway,
            IOsmGeoJsonConverter osmGeoJsonConverter,
            IRemoteFileFetcherGateway remoteFileFetcherGateway,
            IDataContainerConverterService dataContainerConverterService,
            ICoordinatesConverter coordinatesConverter, 
            IDouglasPeuckerReductionService douglasPeuckerReductionService)
        {
            _overpassGateway = overpassGateway;
            _osmGeoJsonConverter = osmGeoJsonConverter;
            _remoteFileFetcherGateway = remoteFileFetcherGateway;
            _dataContainerConverterService = dataContainerConverterService;
            _coordinatesConverter = coordinatesConverter;
            _douglasPeuckerReductionService = douglasPeuckerReductionService;
        }

        public async Task<List<Feature>> GetHighways(string northEast, string southWest)
        {
            var highways = await _overpassGateway.GetHighways(new LatLng(northEast), new LatLng(southWest));
            return highways.Select(_osmGeoJsonConverter.ToGeoJson).Where(g => g != null).ToList();
        }

        [Authorize]
        public async Task<FeatureCollection> PostGpsTrace(string url)
        {
            var response = await _remoteFileFetcherGateway.GetFileContent(url);
            // HM TODO: remove this:
            //response.Content = File.ReadAllBytes(@"D:\off-road.io export5405355290918912.gpx");
            //response.FileName = "off-road.io export5405355290918912.gpx";
            //
            var gpxBytes = await _dataContainerConverterService.Convert(response.Content, response.FileName, DataContainerConverterService.GPX);
            var gpx = gpxBytes.ToGpx();
            gpx.UpdateBounds();
            var routingType = GetRoutingType(gpx);
            var lineStringsInArea = await GetLineStringsInArea(gpx.metadata.bounds);
            var split = SplitGpx(gpx, lineStringsInArea);
            SimplifyLines(split);
            var attributesTable = new AttributesTable();
            attributesTable.AddAttribute("routingType", routingType);
            var features = split.Select(l => new Feature(ToWgs84LineString(l.Coordinates), attributesTable) as IFeature).ToList();
            return new FeatureCollection( new Collection<IFeature>(features));
        }

        private List<LineString> SplitGpx(gpxType gpx, List<LineString> lineStrings)
        {
            var gpxSplit = new List<LineString>();
            var gpxLines = GetLineStings(gpx);
            foreach (var lineString in gpxLines)
            {
                var waypointsGroup = new List<Coordinate>();
                foreach (var coordinate in lineString.Coordinates.Reverse())
                {
                    if (waypointsGroup.Count > 0 && waypointsGroup.Last().Equals(coordinate))
                    {
                        continue;
                    }
                    if (IsSharpTurn(coordinate, waypointsGroup))
                    {
                        var previousPoint = waypointsGroup.Last();
                        AddLineString(gpxSplit, waypointsGroup.ToArray(), lineStrings);
                        waypointsGroup = new List<Coordinate> { previousPoint };
                    }
                    if (IsCloseToALine(coordinate, lineStrings) == false)
                    {
                        waypointsGroup.Add(coordinate);
                        continue;
                    }
                    waypointsGroup.Add(coordinate);
                    AddLineString(gpxSplit, waypointsGroup.ToArray(), lineStrings);
                    waypointsGroup = new List<Coordinate> {coordinate};
                }
                AddLineString(gpxSplit, waypointsGroup.ToArray(), lineStrings);
            }

            // return only lists with non-mapped points that are long enough
            return gpxSplit.Where(l => l.Length > MINIMAL_MISSING_PART_LENGTH).ToList();
        }

        private bool IsSharpTurn(Coordinate coordinate, List<Coordinate> waypointsGroup)
        {
            if (waypointsGroup.Count < 2)
            {
                return false;
            }
            var angle1 = GetAngle(waypointsGroup.Last(), coordinate);
            var angle2 = GetAngle(waypointsGroup[waypointsGroup.Count - 2], waypointsGroup.Last());
            var angleDifference = Math.Abs(angle1 - angle2);
            return (angleDifference > 180 - ANGLE_VARIATION) && (angleDifference < 180 + ANGLE_VARIATION);
        }

        private double GetAngle(Coordinate coordinate1, Coordinate coordinate2)
        {
            // Can't use LineString's angle due to bug in NTS: https://github.com/NetTopologySuite/NetTopologySuite/issues/136
            var xDiff = coordinate2.X - coordinate1.X;
            var yDiff = coordinate2.Y - coordinate1.Y;
            var angle = Math.Atan(yDiff / xDiff) * 180 / Math.PI;
            if (xDiff < 0)
            {
                angle += 180;
            }
            if (angle < 0)
            {
                angle += 360;
            }
            return angle;
        }

        private void AddLineString(ICollection<LineString> gpxSplit, Coordinate[] coordinates, List<LineString> lineStrings)
        {
            if (coordinates.Length < 3)
            {
                return;
            }
            var lineString = new LineString(coordinates);
            gpxSplit.Add(lineString);
            lineStrings.Add(lineString);
        }

        private bool IsCloseToALine(Coordinate coordinate, List<LineString> lineStrings)
        {
            var point = new Point(coordinate);
            if (!lineStrings.Any())
            {
                return false;
            }
            return lineStrings.Min(l => l.Distance(point)) < CLOSEST_POINT_TOLERANCE;
        }

        private async Task<List<LineString>> GetLineStringsInArea(boundsType bounds)
        {
            var highways = await _overpassGateway.GetHighways(new LatLng((double)bounds.maxlat, (double)bounds.maxlon), new LatLng((double)bounds.minlat, (double)bounds.minlon));
            return highways.Select(highway => ToItmLineString(highway.Nodes)).ToList();
        }

        private void SimplifyLines(List<LineString> lineStings)
        {
            for (int lineStringIndex = 0; lineStringIndex < lineStings.Count; lineStringIndex++)
            {
                var lineSting = lineStings[lineStringIndex];
                var simplifiedIndexes = _douglasPeuckerReductionService.GetSimplifiedRouteIndexes(
                        lineSting.Coordinates, CLOSEST_POINT_TOLERANCE / 2);
                var coordinates = lineSting.Coordinates.Where((w, i) => simplifiedIndexes.Contains(i)).ToArray();
                lineStings[lineStringIndex] = new LineString(coordinates);
            }
        }

        private string GetRoutingType(IReadOnlyCollection<wptType[]> waypointsGoups)
        {
            var velocityList = new List<double>();
            if (waypointsGoups.Count == 0)
            {
                return RoutingType.HIKE;
            }
            foreach (var waypoints in waypointsGoups)
            {
                if (waypoints.Last().timeSpecified == false || waypoints.First().timeSpecified == false)
                {
                    velocityList.Add(0);
                    continue;
                }
                var lengthInKm = ToItmLineString(waypoints).Length / 1000;
                var timeInHours = (waypoints.Last().time - waypoints.First().time).TotalHours;
                velocityList.Add(lengthInKm / timeInHours);
            }
            var velocity = velocityList.Sum()/velocityList.Count;
            if (velocity <= 6)
            {
                return RoutingType.HIKE;
            }
            if (velocity <= 12)
            {
                return RoutingType.BIKE;
            }
            return RoutingType.FOUR_WHEEL_DRIVE;
        }

        private LineString ToItmLineString(IEnumerable<Node> nodes)
        {
            var coordinates = nodes.Select(n =>
            {
                var northEast = _coordinatesConverter.Wgs84ToItm(new LatLon { Longitude = n.Longitude.Value, Latitude = n.Latitude.Value });
                return new Coordinate(northEast.East, northEast.North);
            }).ToArray();
            return new LineString(coordinates);
        }

        private LineString ToItmLineString(IEnumerable<wptType> waypoints)
        {
            var coordinates = waypoints.Select(wptType =>
            {
                var northEast = _coordinatesConverter.Wgs84ToItm(new LatLon { Longitude = (double)wptType.lon, Latitude = (double)wptType.lat });
                return new Coordinate(northEast.East, northEast.North);
            }).ToArray();
            return new LineString(coordinates);
        }

        private LineString ToWgs84LineString(IEnumerable<Coordinate> coordinates)
        {
            var cwgs84Coordinates = coordinates.Select(coordinate =>
            {
                var latLng = _coordinatesConverter.ItmToWgs84(new NorthEast { North = (int)coordinate.Y, East = (int)coordinate.X });
                return new Coordinate(latLng.Longitude, latLng.Latitude);
            }).ToArray();
            return new LineString(cwgs84Coordinates);
        }

        private string GetRoutingType(gpxType gpx)
        {
            var waypointsGroups = new List<wptType[]>();
            waypointsGroups.AddRange((gpx.rte ?? new rteType[0]).Select(route => route.rtept).Where(ps => ps.All(p => p.timeSpecified)).ToArray());
            waypointsGroups.AddRange((gpx.trk ?? new trkType[0]).Select(track => track.trkseg.SelectMany(s => s.trkpt).ToArray()).Where(ps => ps.All(p => p.timeSpecified)));
            return GetRoutingType(waypointsGroups);
        }

        private List<LineString> GetLineStings(gpxType gpx)
        {
            var lineStings = (gpx.rte ?? new rteType[0])
                .Select(route => ToItmLineString(route.rtept)).ToList();
            var tracksPointsList = (gpx.trk ?? new trkType[0])
                .Select(track => track.trkseg.SelectMany(s => s.trkpt).ToArray())
                .Select(ToItmLineString);
            lineStings.AddRange(tracksPointsList);
            return lineStings;
        }
    }
}
