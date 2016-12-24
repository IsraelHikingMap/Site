using System.Collections.Generic;
using System.Collections.ObjectModel;
using System.Linq;
using System.Net.Http;
using System.Threading.Tasks;
using System.Web.Http;
using GeoAPI.Geometries;
using IsraelHiking.API.Gpx;
using IsraelHiking.API.Gpx.GpxTypes;
using IsraelHiking.API.Services;
using IsraelHiking.API.Services.Osm;
using IsraelHiking.Common;
using IsraelHiking.DataAccessInterfaces;
using IsraelTransverseMercator;
using NetTopologySuite.Features;
using NetTopologySuite.Geometries;

namespace IsraelHiking.API.Controllers
{
    public class OsmController : ApiController
    {
        private readonly IHttpGatewayFactory _httpGatewayFactory;
        private readonly IDataContainerConverterService _dataContainerConverterService;
        private readonly ICoordinatesConverter _coordinatesConverter;
        private readonly IElasticSearchGateway _elasticSearchGateway;
        private readonly IAddibleGpxLinesFinderService _addibleGpxLinesFinderService;
        private readonly IOsmLineAdderService _osmLineAdderService;
        private readonly IConfigurationProvider _configurationProvider;
        private readonly LruCache<string, TokenAndSecret> _cache;

        public OsmController(IHttpGatewayFactory httpGatewayFactory,
            IDataContainerConverterService dataContainerConverterService,
            ICoordinatesConverter coordinatesConverter,
            IElasticSearchGateway elasticSearchGateway,
            IAddibleGpxLinesFinderService addibleGpxLinesFinderService,
            IOsmLineAdderService osmLineAdderService,
            IConfigurationProvider configurationProvider,
            LruCache<string, TokenAndSecret> cache)
        {
            _httpGatewayFactory = httpGatewayFactory;
            _dataContainerConverterService = dataContainerConverterService;
            _coordinatesConverter = coordinatesConverter;
            _elasticSearchGateway = elasticSearchGateway;
            _addibleGpxLinesFinderService = addibleGpxLinesFinderService;
            _osmLineAdderService = osmLineAdderService;
            _configurationProvider = configurationProvider;
            _cache = cache;
        }

        public async Task<List<Feature>> GetHighways(string northEast, string southWest)
        {
            return await _elasticSearchGateway.GetHighways(new LatLng(northEast), new LatLng(southWest));
        }

        [HttpGet]
        [Route("api/osm/configuration")]
        public object GetConfigurations()
        {
            return new
            {
                ConsumerKey = _configurationProvider.OsmConsumerKey,
                ConsumerSecret = _configurationProvider.OsmConsumerSecret,
                BaseAddress = _configurationProvider.OsmBaseAddress
            };
        }

        [Authorize]
        public async Task PutGpsTraceIntoOsm(Feature feature)
        {
            var tags = feature.Attributes.GetNames().ToDictionary(n => n, n => feature.Attributes[n].ToString());
            await _osmLineAdderService.Add(feature.Geometry as LineString, tags, _cache.Get(User.Identity.Name));
        }

        public async Task<FeatureCollection> PostGpsTrace(string url)
        {
            var response = await GetFile(url);
            var gpxBytes = await _dataContainerConverterService.Convert(response.Content, response.FileName, DataContainerConverterService.GPX);
            var gpx = gpxBytes.ToGpx().UpdateBounds();
            var highwayType = GetHighwayType(gpx);
            var gpxLines = GpxToLineStrings(gpx);
            var manipulatedLines = await _addibleGpxLinesFinderService.GetLines(gpxLines);
            var attributesTable = new AttributesTable();
            attributesTable.AddAttribute("highway", highwayType);
            var features = manipulatedLines.Select(l => new Feature(ToWgs84LineString(l.Coordinates), attributesTable) as IFeature).ToList();
            return new FeatureCollection(new Collection<IFeature>(features));
        }

        private async Task<RemoteFileFetcherGatewayResponse> GetFile(string url)
        {
            if (string.IsNullOrEmpty(url) == false)
            {
                var fetcher = _httpGatewayFactory.CreateRemoteFileFetcherGateway(_cache.Get(User.Identity.Name));
                return await fetcher.GetFileContent(url);
            }
            var streamProvider = new MultipartMemoryStreamProvider();
            var multipartFileStreamProvider = await Request.Content.ReadAsMultipartAsync(streamProvider);

            if (multipartFileStreamProvider.Contents.Count == 0)
            {
                return new RemoteFileFetcherGatewayResponse();
            }
            return new RemoteFileFetcherGatewayResponse
            {
                Content = await streamProvider.Contents.First().ReadAsByteArrayAsync(),
                FileName = streamProvider.Contents.First().Headers.ContentDisposition.FileName.Trim('"')
            };
        }

        private string GetHighwayType(gpxType gpx)
        {
            var waypointsGroups = new List<wptType[]>();
            waypointsGroups.AddRange((gpx.rte ?? new rteType[0]).Select(route => route.rtept).Where(ps => ps.All(p => p.timeSpecified)).ToArray());
            waypointsGroups.AddRange((gpx.trk ?? new trkType[0]).Select(track => track.trkseg.SelectMany(s => s.trkpt).ToArray()).Where(ps => ps.All(p => p.timeSpecified)));
            return GetHighwayTypeFromWaypoints(waypointsGroups);
        }

        /// <summary>
        /// Determines routing type by calculating the average speed of each set of points.
        /// </summary>
        /// <param name="waypointsGoups">A list of group of points</param>
        /// <returns>The calculated routing type</returns>
        private string GetHighwayTypeFromWaypoints(IReadOnlyCollection<wptType[]> waypointsGoups)
        {
            var velocityList = new List<double>();
            if (waypointsGoups.Count == 0)
            {
                return "track";
            }
            foreach (var waypoints in waypointsGoups)
            {
                if (waypoints.Last().timeSpecified == false || waypoints.First().timeSpecified == false)
                {
                    velocityList.Add(0);
                    continue;
                }
                var lengthInKm = ToItmLineString(waypoints).Length/1000;
                var timeInHours = (waypoints.Last().time - waypoints.First().time).TotalHours;
                velocityList.Add(lengthInKm/timeInHours);
            }
            var averageVelocity = velocityList.Sum()/velocityList.Count;
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

        private LineString ToItmLineString(IEnumerable<wptType> waypoints)
        {
            var coordinates = waypoints.Select(wptType =>
            {
                var northEast = _coordinatesConverter.Wgs84ToItm(new LatLon
                {
                    Longitude = (double) wptType.lon,
                    Latitude = (double) wptType.lat
                });
                return new Coordinate(northEast.East, northEast.North);
            }).ToArray();
            return new LineString(coordinates);
        }

        private LineString ToWgs84LineString(IEnumerable<Coordinate> coordinates)
        {
            var cwgs84Coordinates = coordinates.Select(coordinate =>
            {
                var latLng = _coordinatesConverter.ItmToWgs84(new NorthEast
                {
                    North = (int) coordinate.Y,
                    East = (int) coordinate.X
                });
                return new Coordinate(latLng.Longitude, latLng.Latitude);
            }).ToArray();
            return new LineString(cwgs84Coordinates);
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
