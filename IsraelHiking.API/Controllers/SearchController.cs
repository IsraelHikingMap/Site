using IsraelHiking.API.Converters;
using IsraelHiking.API.Converters.CoordinatesParsers;
using IsraelHiking.Common;
using IsraelHiking.Common.Extensions;
using IsraelHiking.Common.Poi;
using IsraelHiking.DataAccessInterfaces.Repositories;
using Microsoft.AspNetCore.Mvc;
using NetTopologySuite.Features;
using NetTopologySuite.Geometries;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;

namespace IsraelHiking.API.Controllers
{
    /// <summary>
    /// This contoller allows search of geo-locations
    /// </summary>
    [Route("api/[controller]")]
    public class SearchController : ControllerBase
    {
        private readonly ISearchRepository _searchRepository;
        private readonly IEnumerable<ICoordinatesParser> _coordinatesParsers;

        /// <summary>
        /// Controller's constructor
        /// </summary>
        /// <param name="searchRepository"></param>
        /// <param name="coordinatesParsers"></param>
        public SearchController(ISearchRepository searchRepository,
            IEnumerable<ICoordinatesParser> coordinatesParsers)
        {
            _searchRepository = searchRepository;
            _coordinatesParsers = coordinatesParsers;
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
        public async Task<IEnumerable<SearchResultsPointOfInterest>> GetSearchResults(string term, string language)
        {
            var coordinates = GetCoordinates(term.Trim());
            if (coordinates != null)
            {
                return new[] {ConvertFromCoordinates(term, coordinates)};
            }
            
            if (term.Count(c => c == ',') == 1)
            {
                var splitted = term.Split(',');
                var place = splitted.Last().Trim();
                term = splitted.First().Trim();
                var placesFeatures = await _searchRepository.SearchPlaces(place, language);
                if (placesFeatures.Any())
                {
                    var envolope = placesFeatures.First().Geometry.EnvelopeInternal;
                    var featuresWithinPlaces = await _searchRepository.SearchByLocation(
                        new Coordinate(envolope.MaxX, envolope.MaxY), new Coordinate(envolope.MinX, envolope.MinY), term, language);
                    return await Task.WhenAll(featuresWithinPlaces.OfType<IFeature>().ToList().Select(f => ConvertFromFeature(f,language)));
                }
            }
            var features = await _searchRepository.Search(term, language);
            return await Task.WhenAll(features.OfType<IFeature>().ToList().Select(f => ConvertFromFeature(f, language)));
        }

        private Coordinate GetCoordinates(string term)
        {
            return _coordinatesParsers.Select(parser => parser.TryParse(term))
                .FirstOrDefault(coordinates => coordinates != null);
        }

        private SearchResultsPointOfInterest ConvertFromCoordinates(string name, Coordinate coordinates)
        {
            var latLng = new LatLng(coordinates.Y, coordinates.X, coordinates.Z);
            return SearchResultsPointOfInterestConverter.FromLatlng(latLng, name);
        }

        private async Task<SearchResultsPointOfInterest> ConvertFromFeature(IFeature feature, string language)
        {
            var searchResultsPoi = SearchResultsPointOfInterestConverter.FromFeature(feature, language);
            searchResultsPoi.DisplayName = await GetDisplayName(feature, language, searchResultsPoi.Title);
            return searchResultsPoi;
        }

        private async Task<string> GetDisplayName(IFeature feature, string language, string title)
        {
            var displayName = title;
            var containers = await _searchRepository.GetContainers(feature.Geometry.Coordinate);
            var geometries = Enumerable.Range(0, feature.Geometry.NumGeometries).Select(i => feature.Geometry.GetGeometryN(i)).ToArray();
            var container = containers.Where(c =>
                    c.Attributes[FeatureAttributes.ID] != feature.Attributes[FeatureAttributes.ID] &&
                    geometries.All(g => c.Geometry.Covers(g)) &&
                    c.Geometry.EqualsTopologically(feature.Geometry) == false)
                .OrderBy(c => c.Geometry.Area)
                .FirstOrDefault();
            var containerTitle = container?.GetTitle(language);
            if (!string.IsNullOrWhiteSpace(containerTitle))
            {
                displayName += ", " + containerTitle;
            }

            return displayName;
        }
    }
}
