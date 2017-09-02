using System.Collections.ObjectModel;
using System.Linq;
using System.Threading.Tasks;
using GeoAPI.Geometries;
using IsraelHiking.API.Services;
using IsraelHiking.DataAccessInterfaces;
using NetTopologySuite.Features;
using Microsoft.AspNetCore.Mvc;
using GeoAPI.CoordinateSystems.Transformations;
using NetTopologySuite.Geometries;
using System.Collections.Generic;
using IsraelHiking.API.Converters.CoordinatesParsers;
using IsraelHiking.API.Executors;

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
        private readonly List<ICoordinatesParser> _coordinatesParsers;

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

            _coordinatesParsers = new List<ICoordinatesParser>
            {
                new ReverseDegreesMinutesSecondsLatLonParser(),
                new DegreesMinutesSecondsLatLonParser(),
                new DecimalLatLonParser(),
                new UtmParser(itmWgs84MathTransform)
            };
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
            var coordinates = GetCoordinates(term.Trim());
            if (coordinates != null)
            {
                return GetFeatureCollectionFromCoordinates(term, coordinates);
            }
            var fieldName = string.IsNullOrWhiteSpace(language) ? "name" : "name:" + language;
            var features = await _elasticSearchGateway.Search(term, fieldName);
            return new FeatureCollection(new Collection<IFeature>(features.OfType<IFeature>().ToList()));
        }

        private Coordinate GetCoordinates(string term)
        {
            foreach (var parser in _coordinatesParsers)
            {
                var coordinates = parser.TryParse(term);
                if (coordinates != null)
                {
                    return coordinates;
                }
            }
            return null;
        }

        private FeatureCollection GetFeatureCollectionFromCoordinates(string name, Coordinate coordinates)
        {
            var table = new AttributesTable();
            table.AddAttribute("name", name);
            var feature = new Feature(new Point(coordinates), table);
            OsmGeoJsonPreprocessorExecutor.UpdateLocation(feature);
            return new FeatureCollection(new Collection<IFeature> {feature});
        }
    }
}
