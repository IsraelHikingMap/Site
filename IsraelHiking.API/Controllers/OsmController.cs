using System.Collections.Generic;
using System.Collections.ObjectModel;
using System.Linq;
using System.Threading.Tasks;
using System.Web.Http;
using GeoAPI.Geometries;
using IsraelHiking.API.Gpx;
using IsraelHiking.API.Gpx.GpxTypes;
using IsraelHiking.API.Services;
using IsraelHiking.Common;
using IsraelHiking.DataAccessInterfaces;
using IsraelTransverseMercator;
using NetTopologySuite.Features;
using NetTopologySuite.Geometries;

namespace IsraelHiking.API.Controllers
{
    public class OsmController : ApiController
    {
        private const double SIMPLIFICATION_TOLERANCE = 15; // meters

        private readonly IHttpGatewayFactory _httpGatewayFactory;
        private readonly IDataContainerConverterService _dataContainerConverterService;
        private readonly IDouglasPeuckerReductionService _douglasPeuckerReductionService;
        private readonly ICoordinatesConverter _coordinatesConverter;
        private readonly IGpxSplitterService _gpxSplitterService;
        private readonly IElasticSearchGateway _elasticSearchGateway;
        private readonly LruCache<string, TokenAndSecret> _cache;

        public OsmController(IHttpGatewayFactory httpGatewayFactory,
            IDataContainerConverterService dataContainerConverterService,
            ICoordinatesConverter coordinatesConverter, 
            IDouglasPeuckerReductionService douglasPeuckerReductionService, 
            IGpxSplitterService gpxSplitterService,
            IElasticSearchGateway elasticSearchGateway,
            LruCache<string, TokenAndSecret> cache)
        {
            _httpGatewayFactory = httpGatewayFactory;
            _dataContainerConverterService = dataContainerConverterService;
            _coordinatesConverter = coordinatesConverter;
            _douglasPeuckerReductionService = douglasPeuckerReductionService;
            _gpxSplitterService = gpxSplitterService;
            _cache = cache;
            _elasticSearchGateway = elasticSearchGateway;
        }

        public async Task<List<Feature>> GetHighways(string northEast, string southWest)
        {
            return await _elasticSearchGateway.GetHighways(new LatLng(northEast), new LatLng(southWest));
        }

        [Authorize]
        public async Task<FeatureCollection> PostGpsTrace(string url)
        {
            var fetcher = _httpGatewayFactory.CreateRemoteFileFetcherGateway(_cache.Get(User.Identity.Name));
            var response = await fetcher.GetFileContent(url);
            var gpxBytes = await _dataContainerConverterService.Convert(response.Content, response.FileName, DataContainerConverterService.GPX);
            var gpx = gpxBytes.ToGpx().UpdateBounds();
            var routingType = GetRoutingType(gpx);
            var gpxLines = GpxToLineStrings(gpx);
            var manipulatedLines = await ManipulateGpxIntoAddibleLines(gpxLines, gpx.metadata.bounds);
            var attributesTable = new AttributesTable();
            attributesTable.AddAttribute("routingType", routingType);
            var features = manipulatedLines.Select(l => new Feature(ToWgs84LineString(l.Coordinates), attributesTable) as IFeature).ToList();
            return new FeatureCollection( new Collection<IFeature>(features));
        }

        private List<LineString> SimplifyLines(IEnumerable<LineString> lineStings)
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

        private LineString ToItmLineString(IEnumerable<wptType> waypoints)
        {
            var coordinates = waypoints.Select(wptType =>
            {
                var northEast = _coordinatesConverter.Wgs84ToItm(new LatLon { Longitude = (double)wptType.lon, Latitude = (double)wptType.lat });
                return new Coordinate(northEast.East, northEast.North);
            }).ToArray();
            return new LineString(coordinates);
        }

        private LineString ToItmLineString(IEnumerable<Coordinate> coordinates)
        {
            var itmCoordinates = coordinates.Select(coordinate =>
            {
                var northEast = _coordinatesConverter.Wgs84ToItm(new LatLon {Longitude = coordinate.X, Latitude = coordinate.Y});
                return new Coordinate(northEast.East, northEast.North);
            }).ToArray();
            return new LineString(itmCoordinates);
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

        private async Task<IEnumerable<LineString>> ManipulateGpxIntoAddibleLines(List<LineString> gpxLines, boundsType bounds)
        {
            var highways = await _elasticSearchGateway.GetHighways(new LatLng((double)bounds.maxlat, (double)bounds.maxlon), new LatLng((double)bounds.minlat, (double)bounds.minlon));
            var lineStringsInArea = highways.Select(highway => highway.Geometry).OfType<LineString>().Select(l => ToItmLineString(l.Coordinates)).ToList();
            gpxLines = _gpxSplitterService.Split(gpxLines, lineStringsInArea);
            gpxLines = SimplifyLines(gpxLines);
            return gpxLines;
        }

        private List<LineString> GpxToLineStrings(gpxType gpx)
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
