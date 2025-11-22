using IsraelHiking.Common;
using IsraelHiking.Common.Extensions;
using IsraelHiking.Common.Poi;
using IsraelHiking.DataAccessInterfaces.Repositories;
using Microsoft.AspNetCore.Mvc;
using NetTopologySuite.Features;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using IsraelHiking.API.Services.Poi;

namespace IsraelHiking.API.Controllers;

/// <summary>
/// This controller allows search of geolocations
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
    /// Gets a geolocation by search term
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
            (term.EndsWith("\"") || term.EndsWith("״")))
        {
            var exactFeatures = await _searchRepository.SearchExact(term.Substring(1, term.Length - 2), language);
            return await Task.WhenAll(exactFeatures.ToList().Select(ConvertFromFeature));
        }
            
        if (term.Count(c => c == ',') == 1)
        {
            var featuresWithinPlaces = await _searchRepository.SearchPlaces(term, language);
            if (featuresWithinPlaces.Count != 0)
            {
                return await Task.WhenAll(featuresWithinPlaces.ToList().Select(ConvertFromFeature));
            }
            term = term.Split(",").First().Trim();
        }

        var features = await _searchRepository.Search(term, language);
        return await Task.WhenAll(features.ToList().Select(ConvertFromFeature));
    }

    private async Task<SearchResultsPointOfInterest> ConvertFromFeature(IFeature feature)
    {
        string language = feature.Attributes[FeatureAttributes.SEARCH_LANGUAGE].ToString();
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
            HasExtraData = feature.HasExtraData(language)
        };
        searchResultsPoi.DisplayName = await GetDisplayName(feature, language, searchResultsPoi.Title);
        return searchResultsPoi;
    }

    private async Task<string> GetDisplayName(IFeature feature, string language, string title)
    {
        var displayName = title;
        var containerTitle = await _searchRepository.GetContainerName([feature.Geometry.Coordinate], language);
        if (!string.IsNullOrWhiteSpace(containerTitle))
        {
            displayName += ", " + containerTitle;
        }
        return displayName;
    }
}