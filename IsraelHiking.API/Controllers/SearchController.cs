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

    /// <summary>Controller's constructor</summary>
    public SearchController(ISearchRepository searchRepository)
    {
        _searchRepository = searchRepository;
    }

    /// <summary>
    /// Gets a geolocation by search term
    /// </summary>
    /// <param name="term">A string to search for</param>
    /// <param name="language">The language to search in</param>
    /// <param name="lat">Optional map center latitude — biases results toward this point</param>
    /// <param name="lng">Optional map center longitude — biases results toward this point</param>
    /// <param name="zoom">Optional map zoom level — controls how tight the proximity bias is</param>
    /// <param name="prefix">True when the user is mid-typing (autocomplete) — favours prefix matches</param>
    /// <returns></returns>
    [HttpGet]
    [Route("{term}")]
    public async Task<IEnumerable<SearchResultsPointOfInterest>> GetSearchResults(string term, string language,
        [FromQuery] double? lat = null, [FromQuery] double? lng = null,
        [FromQuery] double zoom = 0, [FromQuery] bool prefix = false)
    {
        if ((term.StartsWith("\"") || term.StartsWith("״")) &&
            (term.EndsWith("\"") || term.EndsWith("״")))
        {
            var exactFeatures = await _searchRepository.SearchExact(term.Substring(1, term.Length - 2), language);
            return await Task.WhenAll(exactFeatures.ToList().Select(ConvertFromFeature));
        }

        if (term.Count(c => c == ',') == 1)
        {
            var featuresWithinPlaces = await _searchRepository.SearchPlaces(term, language, lat, lng, zoom, prefix);
            if (featuresWithinPlaces.Count != 0)
            {
                return await Task.WhenAll(featuresWithinPlaces.ToList().Select(ConvertFromFeature));
            }
            term = term.Split(",").First().Trim();
        }

        var features = await _searchRepository.Search(term, language, lat, lng, zoom, prefix);
        return await Task.WhenAll(features.ToList().Select(ConvertFromFeature));
    }

    private async Task<SearchResultsPointOfInterest> ConvertFromFeature(IFeature feature)
    {
        string language = feature.Attributes[FeatureAttributes.SEARCH_LANGUAGE].ToString();
        var title = feature.GetTitle(language);
        var geoLocation = feature.GetLocation();
        var latLng = new LatLng(geoLocation.Y, geoLocation.X);
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
        if (DebugSearch)
        {
            searchResultsPoi.Debug = BuildDebugInfo(feature, language, searchResultsPoi);
        }
        return searchResultsPoi;
    }

    // DEBUG_SEARCH (env-gated): expose raw ranking signals the production response hides. When unset,
    // Debug stays null and is omitted from the JSON. `internal` so tests can drive both paths.
    internal static bool DebugSearch { get; set; } =
        (System.Environment.GetEnvironmentVariable("DEBUG_SEARCH") ?? "")
            .Trim().ToLowerInvariant() is "true" or "1" or "yes";

    private static SearchDebugInfo BuildDebugInfo(IFeature feature, string language,
        SearchResultsPointOfInterest poi)
    {
        var debug = new SearchDebugInfo();
        if (feature.Attributes.Exists(FeatureAttributes.FEATURE_CLASS))
        {
            debug.FeatureClass = feature.Attributes[FeatureAttributes.FEATURE_CLASS]?.ToString();
        }
        if (feature.Attributes.Exists(FeatureAttributes.PROMINENCE) &&
            feature.Attributes[FeatureAttributes.PROMINENCE] is float prom)
        {
            debug.Prominence = prom;
        }
        if (feature.Attributes.Exists(FeatureAttributes.SEARCH_LANGUAGE))
        {
            debug.MatchedLanguage = feature.Attributes[FeatureAttributes.SEARCH_LANGUAGE]?.ToString();
        }
        // Recover flattened "alt_name"/"alt_name:<lang>" attributes into a {lang: [variants]} map.
        var altNames = new Dictionary<string, List<string>>();
        foreach (var name in feature.Attributes.GetNames())
        {
            if (name != "alt_name" && !name.StartsWith("alt_name:"))
            {
                continue;
            }
            var lang = name == "alt_name" ? "default" : name.Substring("alt_name:".Length);
            var joined = feature.Attributes[name]?.ToString();
            if (!string.IsNullOrWhiteSpace(joined))
            {
                altNames[lang] = joined.Split("; ").Select(v => v.Trim())
                    .Where(v => v.Length > 0).ToList();
            }
        }
        if (altNames.Count > 0)
        {
            debug.AltNames = altNames;
        }
        // Container = the "Title, Container" suffix of displayName, exposed directly.
        if (!string.IsNullOrWhiteSpace(poi.DisplayName) && poi.DisplayName != poi.Title &&
            poi.DisplayName.StartsWith(poi.Title + ", "))
        {
            debug.Container = poi.DisplayName.Substring((poi.Title + ", ").Length);
        }
        // Score diagnostics: final score, raw BM25, explain tree, and a lightweight term breakdown.
        if (feature.Attributes.Exists(FeatureAttributes.SCORE) &&
            feature.Attributes[FeatureAttributes.SCORE] is double score)
        {
            debug.Score = score;
        }
        if (feature.Attributes.Exists(FeatureAttributes.BM25) &&
            feature.Attributes[FeatureAttributes.BM25] is double bm25)
        {
            debug.Bm25 = bm25;
            var breakdown = new Dictionary<string, double>
            {
                // text_norm = bm25/(bm25+k_text), k_text=1.0
                ["text_norm"] = bm25 / (bm25 + 1.0),
            };
            if (debug.Prominence.HasValue)
            {
                breakdown["prom_input"] = debug.Prominence.Value;
            }
            debug.ScoreBreakdown = breakdown;
        }
        if (feature.Attributes.Exists(FeatureAttributes.EXPLAIN))
        {
            debug.Explain = feature.Attributes[FeatureAttributes.EXPLAIN];
        }
        return debug;
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