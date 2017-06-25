using System.Collections.ObjectModel;
using System.Linq;
using System.Threading.Tasks;
using GeoAPI.Geometries;
using IsraelHiking.API.Gpx;
using IsraelHiking.API.Services;
using IsraelHiking.Common;
using IsraelHiking.DataAccessInterfaces;
using NetTopologySuite.Features;
using Microsoft.AspNetCore.Mvc;
using System.Text.RegularExpressions;
using GeoAPI.CoordinateSystems.Transformations;
using NetTopologySuite.Geometries;

namespace IsraelHiking.API.Controllers
{
    /// <summary>
    /// This contoller allows search of geo-locations
    /// </summary>
    [Route("api/[controller]")]
    public class SearchController : Controller
    {
        private readonly IElevationDataStorage _elevationDataStorage;
        private readonly IElasticSearchGateway _elasticSearchGateway;
        private readonly IDataContainerConverterService _dataContainerConverterService;
        private readonly IMathTransform _itmWgs84MathTransform;

        /// <summary>
        /// Controller's constructor
        /// </summary>
        /// <param name="elasticSearchGateway"></param>
        /// <param name="dataContainerConverterService"></param>
        /// <param name="elevationDataStorage"></param>
        /// <param name="itmWgs84MathTransform"></param>
        public SearchController(IElasticSearchGateway elasticSearchGateway,
            IDataContainerConverterService dataContainerConverterService,
            IElevationDataStorage elevationDataStorage,
            IMathTransform itmWgs84MathTransform)
        {
            _elasticSearchGateway = elasticSearchGateway;
            _dataContainerConverterService = dataContainerConverterService;
            _elevationDataStorage = elevationDataStorage;
            _itmWgs84MathTransform = itmWgs84MathTransform;
        }

        /// <summary>
        /// Gets a geo location by search term
        /// </summary>
        /// <param name="term">A string to search for</param>
        /// <param name="language">The language to search in</param>
        /// <returns></returns>
        // GET api/search/abc&language=en
        [HttpGet]
        [Route("{term}")]
        public async Task<FeatureCollection> GetSearchResults(string term, string language = null)
        {
            var coordinatesFeature = GetCoordinates(term);
            if (coordinatesFeature != null)
            {
                return new FeatureCollection(new Collection<IFeature> { GetFeatureFromCoordinates(term, coordinatesFeature) });
            }
            var fieldName = string.IsNullOrWhiteSpace(language) ? "name" : "name:" + language;
            var features = await _elasticSearchGateway.Search(term, fieldName);
            return new FeatureCollection(new Collection<IFeature>(features.OfType<IFeature>().ToList()));
        }

        /// <summary>
        /// Converts a search results to <see cref="DataContainer"/>
        /// </summary>
        /// <param name="feature">The feature to convert</param>
        /// <returns>The converted feature</returns>
        [HttpPost]
        public async Task<DataContainer> PostConvertSearchResults([FromBody]Feature feature)
        {
            var name = "israelHiking";
            if (feature.Attributes.GetNames().Contains("name"))
            {
                name = feature.Attributes["name"].ToString();
            }
            var featureCollection = new FeatureCollection(new Collection<IFeature> { feature });
            var dataContainer = await _dataContainerConverterService.ToDataContainer(featureCollection.ToBytes(), name + ".geojson");
            foreach (var latLng in dataContainer.routes.SelectMany(routeData => routeData.segments.SelectMany(routeSegmentData => routeSegmentData.latlngs)))
            {
                latLng.alt = await _elevationDataStorage.GetElevation(new Coordinate().FromLatLng(latLng));
            }
            return dataContainer;
        }

        private Coordinate GetCoordinates(string term)
        {
            var latLonRegEx = new Regex(@"[-+]?([1-8]?\d(\.\d+)?|90(\.0+)?)°?(?:\s*[,|]\s*)[-+]?(180(\.0+)?|((1[0-7]\d)|([1-9]?\d))(\.\d+)?)°?");
            var latLonMatch = latLonRegEx.Match(term);
            if (latLonMatch.Success)
            {
                return new Coordinate(double.Parse(latLonMatch.Groups[4].Value), double.Parse(latLonMatch.Groups[1].Value));
            }
            var itmRegEx = new Regex(@"(\d{6})(?:\s*,?\s*)(\d{6})");
            var itmMatch = itmRegEx.Match(term);
            if (itmMatch.Success)
            {
                return _itmWgs84MathTransform.Transform(new Coordinate(double.Parse(itmMatch.Groups[1].Value), double.Parse(itmMatch.Groups[2].Value)));
            }
            return null;
        }

        private Feature GetFeatureFromCoordinates(string name, Coordinate coordinates)
        {
            return new Feature(new Point(coordinates), new AttributesTable { { "name", name } });
        }
    }
}
