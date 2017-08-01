using System.Collections.Generic;
using System.Collections.ObjectModel;
using System.IO;
using System.Linq;
using System.Threading.Tasks;
using GeoAPI.Geometries;
using IsraelHiking.API.Gpx;
using IsraelHiking.API.Services;
using IsraelHiking.API.Services.Osm;
using IsraelHiking.Common;
using IsraelHiking.DataAccessInterfaces;
using NetTopologySuite.Features;
using NetTopologySuite.Geometries;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http;
using GeoAPI.CoordinateSystems.Transformations;
using Microsoft.Extensions.Options;
using NetTopologySuite.IO;
using IsraelHiking.API.Swagger;
using Swashbuckle.AspNetCore.SwaggerGen;

namespace IsraelHiking.API.Controllers
{
    /// <summary>
    /// This controller is responsible for all OSM related requests
    /// </summary>
    [Route("api/[controller]")]
    public class OsmController : Controller
    {
        private readonly IHttpGatewayFactory _httpGatewayFactory;
        private readonly IDataContainerConverterService _dataContainerConverterService;
        private readonly IMathTransform _itmWgs84MathTransform;
        private readonly IElasticSearchGateway _elasticSearchGateway;
        private readonly IAddibleGpxLinesFinderService _addibleGpxLinesFinderService;
        private readonly IOsmLineAdderService _osmLineAdderService;
        private readonly IGeometryFactory _geometryFactory;
        private readonly LruCache<string, TokenAndSecret> _cache;
        private readonly ConfigurationData _options;

        /// <summary>
        /// Controller's constructor
        /// </summary>
        /// <param name="httpGatewayFactory"></param>
        /// <param name="dataContainerConverterService"></param>
        /// <param name="itmWgs84MathTransform"></param>
        /// <param name="elasticSearchGateway"></param>
        /// <param name="addibleGpxLinesFinderService"></param>
        /// <param name="osmLineAdderService"></param>
        /// <param name="options"></param>
        /// <param name="geometryFactory"></param>
        /// <param name="cache"></param>
        public OsmController(IHttpGatewayFactory httpGatewayFactory,
            IDataContainerConverterService dataContainerConverterService,
            IMathTransform itmWgs84MathTransform,
            IElasticSearchGateway elasticSearchGateway,
            IAddibleGpxLinesFinderService addibleGpxLinesFinderService,
            IOsmLineAdderService osmLineAdderService,
            IOptions<ConfigurationData> options,
            IGeometryFactory geometryFactory,
            LruCache<string, TokenAndSecret> cache)
        {
            _httpGatewayFactory = httpGatewayFactory;
            _dataContainerConverterService = dataContainerConverterService;
            _itmWgs84MathTransform = itmWgs84MathTransform;
            _elasticSearchGateway = elasticSearchGateway;
            _addibleGpxLinesFinderService = addibleGpxLinesFinderService;
            _osmLineAdderService = osmLineAdderService;
            _options = options.Value;
            _geometryFactory = geometryFactory;
            _cache = cache;
        }

        /// <summary>
        /// Get a list of highways in the given bounding box
        /// </summary>
        /// <param name="northEast">Bounding box's north-east coordinates</param>
        /// <param name="southWest">Bounding box's south-west coordinates</param>
        /// <returns>A list of features in GeoJSON format</returns>
        // GET api/osm?northeast=1.2,3.4&southwest=5.6,7.8
        [HttpGet]
        public async Task<List<Feature>> GetHighways(string northEast, string southWest)
        {
            return await _elasticSearchGateway.GetHighways(new Coordinate().FromLatLng(northEast), new Coordinate().FromLatLng(southWest));
        }

        /// <summary>
        /// Get the OSM server configuration
        /// </summary>
        /// <returns>The OSM server configurations</returns>
        [HttpGet]
        [Route("configuration")]
        public OsmConfiguraionData GetConfigurations()
        {
            return _options.OsmConfiguraion;
        }

        /// <summary>
        /// Adds a route to OSM - this requires to be logged in to OSM
        /// </summary>
        /// <param name="feature"></param>
        /// <returns></returns>
        [Authorize]
        [HttpPut]
        public async Task PutGpsTraceIntoOsm([FromBody]Feature feature)
        {
            var tags = feature.Attributes.GetNames().ToDictionary(n => n, n => feature.Attributes[n].ToString());
            await _osmLineAdderService.Add(feature.Geometry as LineString, tags, _cache.Get(User.Identity.Name));
        }

        /// <summary>
        /// Finds unmapped parts of a given route
        /// </summary>
        /// <param name="file">The file to use for finding</param>
        /// <param name="url">The url to fetch a file from - optional, use file uploaded if not provided</param>
        /// <returns></returns>
        [HttpPost]
        [ProducesResponseType(typeof(FeatureCollection), 200)]
        [SwaggerOperationFilter(typeof(OptionalFileUploadParams))]
        public async Task<IActionResult> PostGpsTrace([FromQuery]string url = "", [FromForm]IFormFile file = null)
        {
            var fileFetcherGatewayResponse = await GetFile(url, file);
            if (fileFetcherGatewayResponse == null)
            {
                return BadRequest("Url is not provided or the file is empty... " + url);
            }
            var gpxBytes = await _dataContainerConverterService.Convert(fileFetcherGatewayResponse.Content, fileFetcherGatewayResponse.FileName, DataContainerConverterService.GPX);
            var gpx = gpxBytes.ToGpx().UpdateBounds();
            var highwayType = GetHighwayType(gpx);
            var gpxItmLines = GpxToItmLineStrings(gpx);
            if (!gpxItmLines.Any())
            {
                return BadRequest("File does not contain any traces...");
            }
            var manipulatedItmLines = await _addibleGpxLinesFinderService.GetLines(gpxItmLines);
            var attributesTable = new AttributesTable {{"highway", highwayType}};
            if (string.IsNullOrEmpty(url) == false)
            {
                attributesTable.Add("source", url);
            }
            var features = manipulatedItmLines.Select(l => new Feature(ToWgs84LineString(l.Coordinates), attributesTable) as IFeature).ToList();
            return Ok(new FeatureCollection(new Collection<IFeature>(features)));
        }


        private async Task<RemoteFileFetcherGatewayResponse> GetFile(string url, IFormFile file)
        {
            if (string.IsNullOrEmpty(url) == false)
            {
                var fetcher = _httpGatewayFactory.CreateRemoteFileFetcherGateway(_cache.Get(User.Identity.Name));
                return await fetcher.GetFileContent(url);
            }
            if (file == null)
            {
                return null;
            }
            using (var memoryStream = new MemoryStream())
            {
                await file.CopyToAsync(memoryStream);
                return new RemoteFileFetcherGatewayResponse
                {
                    Content = memoryStream.ToArray(),
                    FileName = file.FileName
                };
            }
        }

        private string GetHighwayType(gpxType gpx)
        {
            var waypointsGroups = new List<wptType[]>();
            waypointsGroups.AddRange((gpx.rte ?? new rteType[0]).Select(route => route.rtept).Where(ps => ps.All(p => p.timeSpecified)).ToArray());
            waypointsGroups.AddRange((gpx.trk ?? new trkType[0]).Where(t => t.trkseg != null).Select(track => track.trkseg.SelectMany(s => s.trkpt).ToArray()).Where(ps => ps.All(p => p.timeSpecified)));
            return GetHighwayTypeFromWaypoints(waypointsGroups);
        }

        /// <summary>
        /// Determines routing type by calculating the average speed of each set of points.
        /// Assuming all the point sent has time specified.
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
            foreach (var waypoints in waypointsGoups.Where(g => g.Length > 1))
            {
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

        private ILineString ToItmLineString(IEnumerable<wptType> waypoints)
        {
            var coordinates = waypoints.Select(wptType => _itmWgs84MathTransform.Inverse().Transform(new Coordinate((double) wptType.lon, (double) wptType.lat)));
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
            var wgs84Coordinates = coordinates.Select(_itmWgs84MathTransform.Transform);
            var nonDuplicates = new List<Coordinate>();
            foreach (var coordinate in wgs84Coordinates)
            {
                if (nonDuplicates.Count <= 0 || !nonDuplicates.Last().Equals2D(coordinate))
                {
                    nonDuplicates.Add(coordinate);
                }
            }
            return new LineString(nonDuplicates.ToArray());
        }

        private List<ILineString> GpxToItmLineStrings(gpxType gpx)
        {
            return (gpx.rte ?? new rteType[0])
                .Select(route => ToItmLineString(route.rtept))
                .Concat((gpx.trk ?? new trkType[0])
                .Select(track => (track.trkseg ?? new trksegType[0])
                .SelectMany(s => s.trkpt))
                .Select(ToItmLineString))
                .Where(l => l.Coordinates.Any())
                .ToList();
        }
    }
}
