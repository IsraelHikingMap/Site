using System.Collections.Generic;
using System.Collections.ObjectModel;
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
        private const double SIMPLIFICATION_TOLERANCE = 15; // meters

        private readonly IOverpassGateway _overpassGateway;
        private readonly IOsmGeoJsonConverter _osmGeoJsonConverter;
        private readonly IHttpGatewayFactory _httpGatewayFactory;
        private readonly IDataContainerConverterService _dataContainerConverterService;
        private readonly IDouglasPeuckerReductionService _douglasPeuckerReductionService;
        private readonly ICoordinatesConverter _coordinatesConverter;
        private readonly IGpxSplitterService _gpxSplitterService;
        private readonly LruCache<string, TokenAndSecret> _cache;

        public OsmController(IOverpassGateway overpassGateway,
            IOsmGeoJsonConverter osmGeoJsonConverter,
            IHttpGatewayFactory httpGatewayFactory,
            IDataContainerConverterService dataContainerConverterService,
            ICoordinatesConverter coordinatesConverter, 
            IDouglasPeuckerReductionService douglasPeuckerReductionService, 
            IGpxSplitterService gpxSplitterService, 
            LruCache<string, TokenAndSecret> cache)
        {
            _overpassGateway = overpassGateway;
            _osmGeoJsonConverter = osmGeoJsonConverter;
            _httpGatewayFactory = httpGatewayFactory;
            _dataContainerConverterService = dataContainerConverterService;
            _coordinatesConverter = coordinatesConverter;
            _douglasPeuckerReductionService = douglasPeuckerReductionService;
            _gpxSplitterService = gpxSplitterService;
            _cache = cache;
        }

        public async Task<List<Feature>> GetHighways(string northEast, string southWest)
        {
            var highways = await _overpassGateway.GetHighways(new LatLng(northEast), new LatLng(southWest));
            return highways.Select(_osmGeoJsonConverter.ToGeoJson).Where(g => g != null).ToList();
        }

        [Authorize]
        public async Task<FeatureCollection> PostGpsTrace(string url)
        {
            var fetcher = _httpGatewayFactory.CreateRemoteFileFetcherGateway(_cache.Get(User.Identity.Name));
            var response = await fetcher.GetFileContent(url);
            var gpxBytes = await _dataContainerConverterService.Convert(response.Content, response.FileName, DataContainerConverterService.GPX);
            var gpx = gpxBytes.ToGpx().UpdateBounds();
            var routingType = GetRoutingType(gpx);
            var lineStringsInArea = await GetLineStringsInArea(gpx.metadata.bounds);
            var manipulatedLines = ManipulateGpxIntoAddibleLines(gpx, lineStringsInArea);
            var attributesTable = new AttributesTable();
            attributesTable.AddAttribute("routingType", routingType);
            var features = manipulatedLines.Select(l => new Feature(ToWgs84LineString(l.Coordinates), attributesTable) as IFeature).ToList();
            return new FeatureCollection( new Collection<IFeature>(features));
        }

        private async Task<List<LineString>> GetLineStringsInArea(boundsType bounds)
        {
            var highways = await _overpassGateway.GetHighways(new LatLng((double)bounds.maxlat, (double)bounds.maxlon), new LatLng((double)bounds.minlat, (double)bounds.minlon));
            return highways.Select(highway => ToItmLineString(highway.Nodes)).ToList();
        }

        private List<LineString> SimplifyLines(List<LineString> lineStings)
        {
            var lines = new List<LineString>();
            foreach (var lineSting in lineStings)
            {
                var simplifiedIndexes = _douglasPeuckerReductionService.GetSimplifiedRouteIndexes(
                    lineSting.Coordinates, SIMPLIFICATION_TOLERANCE);
                var coordinates = lineSting.Coordinates.Where((w, i) => simplifiedIndexes.Contains(i)).ToArray();
                lines.Add(new LineString(coordinates));
            }
            return lines;
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

        private List<LineString> ManipulateGpxIntoAddibleLines(gpxType gpx, List<LineString> lineStringsInArea)
        {
            var lineStings = (gpx.rte ?? new rteType[0])
                .Select(route => ToItmLineString(route.rtept)).ToList();
            var tracksPointsList = (gpx.trk ?? new trkType[0])
                .Select(track => track.trkseg.SelectMany(s => s.trkpt).ToArray())
                .Select(ToItmLineString);
            lineStings.AddRange(tracksPointsList);

            lineStings = _gpxSplitterService.Split(lineStings, lineStringsInArea);
            lineStings = SimplifyLines(lineStings);

            return lineStings;
        }
    }
}
