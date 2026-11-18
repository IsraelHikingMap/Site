using IsraelHiking.Common.Poi;
using IsraelHiking.DataAccessInterfaces.Repositories;
using Microsoft.AspNetCore.Mvc;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;

namespace IsraelHiking.API.Controllers;

/// <summary>
/// This controller allows search of geolocations
/// </summary>
[Route("api/[controller]")]
[ApiController]
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
    /// Search locations
    /// </summary>
    /// <remarks>Searches for geolocations (points of interest) matching the given term in the given language.</remarks>
    /// <param name="term">A string to search for</param>
    /// <param name="language">The language to search in</param>
    /// <param name="lat">Optional map center latitude — biases results toward this point</param>
    /// <param name="lng">Optional map center longitude — biases results toward this point</param>
    /// <param name="zoom">Optional map zoom level — controls how tight the proximity bias is</param>
    /// <param name="prefix">True when the user is mid-typing (autocomplete) — favours prefix matches</param>
    /// <returns></returns>
    // GET api/search/abc&language=en
    [HttpGet]
    [Route("{term}")]
    public async Task<IEnumerable<SearchResultsPointOfInterest>> GetSearchResults(string term, string language,
        [FromQuery] double? lat = null, [FromQuery] double? lng = null,
        [FromQuery] double? zoom = null, [FromQuery] bool prefix = false)
    {
        if (term.Length >= 2 &&
            (term.StartsWith("\"") || term.StartsWith("״")) &&
            (term.EndsWith("\"") || term.EndsWith("״")))
        {
            return await _searchRepository.SearchExact(term.Substring(1, term.Length - 2), language);
        }

        if (term.Contains(','))
        {
            var resultsWithinPlaces = await _searchRepository.SearchPlaces(term, language, lat, lng, zoom, prefix);
            if (resultsWithinPlaces.Count != 0)
            {
                return resultsWithinPlaces;
            }
            term = term.Split(",").First().Trim();
        }

        return await _searchRepository.Search(term, language, lat, lng, zoom, prefix);
    }
}