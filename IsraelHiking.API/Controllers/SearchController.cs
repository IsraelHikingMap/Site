using System.Collections.ObjectModel;
using System.Linq;
using System.Threading.Tasks;
using GeoAPI.Geometries;
using IsraelHiking.DataAccessInterfaces;
using NetTopologySuite.Features;
using Microsoft.AspNetCore.Mvc;
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
        private readonly IElasticSearchGateway _elasticSearchGateway;
        private readonly List<ICoordinatesParser> _coordinatesParsers;

        /// <summary>
        /// Controller's constructor
        /// </summary>
        /// <param name="elasticSearchGateway"></param>
        /// <param name="itmWgs84MathTransfromFactory"></param>
        public SearchController(IElasticSearchGateway elasticSearchGateway,
            IItmWgs84MathTransfromFactory itmWgs84MathTransfromFactory)
        {
            _elasticSearchGateway = elasticSearchGateway;
            _coordinatesParsers = new List<ICoordinatesParser>
            {
                new ReverseDegreesMinutesSecondsLatLonParser(),
                new DegreesMinutesSecondsLatLonParser(),
                new DecimalLatLonParser(),
                new UtmParser(itmWgs84MathTransfromFactory.Create())
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
            if (term.Count(c => c == ',') == 1)
            {
                var splitted = term.Split(',');
                var place = splitted.Last().Trim();
                term = splitted.First().Trim();
                var placesFeatures = await _elasticSearchGateway.SearchPlaces(place, fieldName);
                if (placesFeatures.Any())
                {
                    var envolope = placesFeatures.First().Geometry.EnvelopeInternal;
                    var featuresWithinPlaces = await _elasticSearchGateway.SearchByLocation(
                        new Coordinate(envolope.MaxX, envolope.MaxY), new Coordinate(envolope.MinX, envolope.MinY), term, fieldName);
                    return new FeatureCollection(new Collection<IFeature>(featuresWithinPlaces.OfType<IFeature>().ToList()));
                }
            }
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
            var table = new AttributesTable {{"name", name}};
            var feature = new Feature(new Point(coordinates), table);
            OsmGeoJsonPreprocessorExecutor.UpdateLocation(feature);
            return new FeatureCollection(new Collection<IFeature> {feature});
        }
    }
}
