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
using IsraelHiking.API.Services.Poi;

namespace IsraelHiking.API.Controllers
{
    /// <summary>
    /// This controller allows search of geo-locations
    /// </summary>
    [Route("api/[controller]")]
    public class SearchController : ControllerBase
    {
        private readonly ISearchRepository _searchRepository;

        /// <summary>
        /// Controller's constructor
        /// </summary>
        /// <param name="searchRepository"></param>
        public SearchController(ISearchRepository searchRepository)
        {
            _searchRepository = searchRepository;
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
            if ((term.StartsWith("\"") || term.StartsWith("״")) && 
                (term.EndsWith("\"") || term.StartsWith("״")))
            {
                var exactFeatures = await _searchRepository.SearchExact(term.Substring(1, term.Length - 2), language);
                return await Task.WhenAll(exactFeatures.ToList().Select(f => ConvertFromFeature(f, language)));
            }
            
            if (term.Count(c => c == ',') == 1)
            {
                var split = term.Split(',');
                var place = split.Last().Trim();
                term = split.First().Trim();
                var placesFeatures = await _searchRepository.SearchPlaces(place, language);
                if (placesFeatures.Any())
                {
                    var envelope = placesFeatures.First().Geometry.EnvelopeInternal;
                    var featuresWithinPlaces = await _searchRepository.SearchByLocation(
                        new Coordinate(envelope.MaxX, envelope.MaxY), new Coordinate(envelope.MinX, envelope.MinY), term, language);
                    return await Task.WhenAll(featuresWithinPlaces.ToList().Select(f => ConvertFromFeature(f,language)));
                }
            }
            var features = await _searchRepository.SearchPoints(term, language);
            return await Task.WhenAll(features.ToList().Select(f => ConvertFromFeature(f, language)));
        }

        private async Task<SearchResultsPointOfInterest> ConvertFromFeature(IFeature feature, string language)
        {
            var title = feature.GetTitle(language);
            var geoLocation = feature.GetLocation();
            var latLng = new LatLng(geoLocation.Y,geoLocation.X);
            var icon = feature.Attributes[FeatureAttributes.POI_ICON].ToString();
            if (string.IsNullOrWhiteSpace(icon))
            {
                icon = PointsOfInterestProvider.SEARCH_ICON;
            }
            var searchResultsPoi = new SearchResultsPointOfInterest
            {
                Id = feature.Attributes[FeatureAttributes.ID].ToString(),
                Title = title,
                Icon = icon,
                IconColor = feature.Attributes[FeatureAttributes.POI_ICON_COLOR].ToString(),
                Source = feature.Attributes[FeatureAttributes.POI_SOURCE].ToString(),
                Location = latLng,
            };
            searchResultsPoi.DisplayName = await GetDisplayName(feature, language, searchResultsPoi.Title);
            return searchResultsPoi;
        }

        private async Task<string> GetDisplayName(IFeature feature, string language, string title)
        {
            var displayName = title;
            var containerTitle = await _searchRepository.GetContainerName(feature.Geometry.Coordinate, language);
            if (!string.IsNullOrWhiteSpace(containerTitle))
            {
                displayName += ", " + containerTitle;
            }
            return displayName;
        }
    }
}
