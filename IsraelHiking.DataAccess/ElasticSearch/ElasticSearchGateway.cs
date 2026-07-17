using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using Elasticsearch.Net;
using IsraelHiking.Common;
using IsraelHiking.Common.Configuration;
using IsraelHiking.Common.Poi;
using IsraelHiking.DataAccessInterfaces;
using IsraelHiking.DataAccessInterfaces.Repositories;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using Nest;
using NetTopologySuite.Geometries;

namespace IsraelHiking.DataAccess.ElasticSearch;

public class ElasticSearchGateway(IOptions<ConfigurationData> options, ILogger logger) :
    IInitializable,
    ISearchRepository,
    IImagesRepository
{
    private readonly ConfigurationData _options = options.Value;

    private const string IMAGES = "images";
    private const string POINTS = "points";
    private const string BBOX = "bbox";

    // The queries themselves live in planet-search, which stores them in Elasticsearch as mustache
    // search templates, so that a query, the index it assumes and its relevance tuning are built,
    // versioned and benchmarked together there. Here we only send the parameters each one declares.
    private const string POINTS_SEARCH_TEMPLATE = "points_search";
    private const string POINTS_SEARCH_EXACT_TEMPLATE = "points_search_exact";
    private const string BBOX_CONTAINS_TEMPLATE = "bbox_contains";

    private const double MIN_LATITUDE = -90;
    private const double MAX_LATITUDE = 90;
    private const double MIN_LONGITUDE = -180;
    private const double MAX_LONGITUDE = 180;

    private IElasticClient _elasticClient;

    public async Task Initialize()
    {
        var uri = _options.ElasticsearchServerAddress;
        var pool = new SingleNodeConnectionPool(new Uri(uri));
        var connectionString = new ConnectionSettings(
                pool,
                new HttpConnection(),
                (_, _) => new SystemTextJsonSerializer())
            .PrettyJson();
        _elasticClient = new ElasticClient(connectionString);
        if ((await _elasticClient.Indices.ExistsAsync(IMAGES)).Exists == false)
        {
            await CreateImagesIndex();
        }
        logger.LogInformation("Finished initialing elasticsearch with uri: " + uri);
    }

    private static SearchResultsPointOfInterest HitToSearchResult(IHit<PointDocument> d, string language)
    {
        var source = d.Source;
        var searchTermLanguage = SearchLanguageDetector.GetBestMatchLanguage(d.MatchedQueries, language);
        var title = ResolveLocalized(source.Name, searchTermLanguage);
        var description = ResolveLocalized(source.Description, searchTermLanguage);
        return new SearchResultsPointOfInterest
        {
            // The indexed id is "<type>_<osmId>"; the leading source segment is dropped for the id.
            Id = string.Join("_", d.Id.Split("_").Skip(1)),
            Title = title,
            DisplayName = BuildDisplayName(title, source, searchTermLanguage),
            Source = source.PoiSource,
            Icon = string.IsNullOrWhiteSpace(source.PoiIcon) ? FeatureAttributes.SEARCH_ICON : source.PoiIcon,
            IconColor = source.PoiIconColor,
            Location = new LatLng(source.Location[1], source.Location[0]),
            HasExtraData = !string.IsNullOrEmpty(description) || !string.IsNullOrWhiteSpace(source.Image)
        };
    }

    /// <summary>
    /// Builds "Title, Container, Country", skipping the container and country when absent.
    /// </summary>
    private static string BuildDisplayName(string title, PointDocument source, string language)
    {
        var parts = new List<string> { title };
        var container = ResolveLocalized(source.PoiContainer, language);
        if (!string.IsNullOrWhiteSpace(container))
        {
            parts.Add(container);
        }
        var country = ResolveLocalized(source.PoiCountry, language);
        if (!string.IsNullOrWhiteSpace(country))
        {
            parts.Add(country);
        }
        return string.Join(", ", parts);
    }

    /// <summary>
    /// Resolves a per-language value to the result's language, falling back to English then the
    /// default. Returns an empty string when the map is null or has none of these.
    /// </summary>
    private static string ResolveLocalized(Dictionary<string, string> localizedValues, string language)
    {
        if (localizedValues is not { } values)
        {
            return string.Empty;
        }
        return values.GetValueOrDefault(language,
            values.GetValueOrDefault(Languages.ENGLISH,
                values.GetValueOrDefault(Languages.DEFAULT, string.Empty)));
    }

    /// <summary>
    /// Runs one of the stored mustache search templates. The templates, and the relevance tuning
    /// inside them, are owned by planet-search and stored in Elasticsearch alongside the index they
    /// were built for, so a query is always swapped together with the index it assumes.
    /// </summary>
    private Task<ISearchResponse<T>> SearchTemplate<T>(string index, string templateId,
        Dictionary<string, object> parameters) where T : class =>
        _elasticClient.SearchTemplateAsync<T>(s => s
            .Index(index)
            .Id(templateId)
            .Params(parameters));

    public static (double lat, double lng)? ResolveMapCenter(double? lat, double? lng)
    {
        if (lat is not { } latitude || lng is not { } longitude)
        {
            return null;
        }
        if (double.IsNaN(latitude) || double.IsNaN(longitude) ||
            double.IsInfinity(latitude) || double.IsInfinity(longitude) ||
            latitude is < MIN_LATITUDE or > MAX_LATITUDE ||
            longitude is < MIN_LONGITUDE or > MAX_LONGITUDE)
        {
            return null;
        }
        return (latitude, longitude);
    }

    public async Task<List<SearchResultsPointOfInterest>> Search(string searchTerm, string language,
        double? lat = null, double? lng = null, double? zoom = null, bool prefix = false)
    {
        if (string.IsNullOrWhiteSpace(searchTerm))
        {
            return [];
        }
        var response = await SearchTemplate<PointDocument>(POINTS, POINTS_SEARCH_TEMPLATE,
            PointsSearchParameters(searchTerm, lat, lng, zoom, prefix));
        return response.Hits.Select(d => HitToSearchResult(d, language)).ToList();
    }

    public async Task<List<SearchResultsPointOfInterest>> SearchExact(string searchTerm, string language)
    {
        if (string.IsNullOrWhiteSpace(searchTerm))
        {
            return [];
        }
        var response = await SearchTemplate<PointDocument>(POINTS, POINTS_SEARCH_EXACT_TEMPLATE,
            new Dictionary<string, object> { ["searchTerm"] = searchTerm });
        return response.Hits.Select(d => HitToSearchResult(d, language)).ToList();
    }

    public async Task<List<SearchResultsPointOfInterest>> SearchPlaces(string searchTerm, string language,
        double? lat = null, double? lng = null, double? zoom = null, bool prefix = false)
    {
        // "name, place[, country, ...]" - the name is the first part and the immediate enclosing
        // place is the second. Any further parts (e.g. the country now shown in the display name)
        // are already implied by the place, so they are ignored.
        var split = searchTerm.Split(',');
        var name = split[0].Trim();
        var place = split.Length > 1 ? split[1].Trim() : string.Empty;
        if (string.IsNullOrWhiteSpace(name) || string.IsNullOrWhiteSpace(place))
        {
            return [];
        }
        var parameters = PointsSearchParameters(name, lat, lng, zoom, prefix);
        parameters["place"] = place;
        var response = await SearchTemplate<PointDocument>(POINTS, POINTS_SEARCH_TEMPLATE, parameters);
        return response.Hits.Select(d => HitToSearchResult(d, language)).ToList();
    }

    private static Dictionary<string, object> PointsSearchParameters(string searchTerm,
        double? lat, double? lng, double? zoom, bool prefix)
    {
        var parameters = new Dictionary<string, object>
        {
            ["searchTerm"] = searchTerm,
            ["prefix"] = prefix
        };
        if (ResolveMapCenter(lat, lng) is not { } center)
        {
            return parameters;
        }
        parameters["hasCenter"] = true;
        parameters["lat"] = center.lat;
        parameters["lng"] = center.lng;
        // The template falls back to its own default zoom for any non-positive value.
        parameters["zoom"] = zoom is { } value && !double.IsNaN(value) && value > 0 ? value : 0.0;
        return parameters;
    }

    public async Task<string> GetContainerName(Coordinate[] coordinates, string language)
    {
        var response = await SearchTemplate<BBoxDocument>(BBOX, BBOX_CONTAINS_TEMPLATE,
            new Dictionary<string, object> { ["shape"] = ToShapeParameter(coordinates) });
        var document = response.Documents.FirstOrDefault();
        return document?.Name.GetValueOrDefault(language, document.Name.GetValueOrDefault(Languages.ENGLISH, document.Name.GetValueOrDefault(Languages.DEFAULT, string.Empty)));
    }

    /// <summary>
    /// A single coordinate is sent as a point, several as the envelope bounding them - GeoJSON, in
    /// [longitude, latitude] order.
    /// </summary>
    private static Dictionary<string, object> ToShapeParameter(Coordinate[] coordinates)
    {
        if (coordinates.Length == 1)
        {
            return new Dictionary<string, object>
            {
                ["type"] = "point",
                ["coordinates"] = new[] { coordinates[0].X, coordinates[0].Y }
            };
        }
        return new Dictionary<string, object>
        {
            ["type"] = "envelope",
            ["coordinates"] = new[]
            {
                new[] { coordinates.Min(c => c.X), coordinates.Max(c => c.Y) },
                new[] { coordinates.Max(c => c.X), coordinates.Min(c => c.Y) }
            }
        };
    }

    private async Task CreateImagesIndex()
    {
        await _elasticClient.Indices.CreateAsync(IMAGES, c =>
            c.Map<ImageItem>(m =>
                m.Properties(p =>
                    p.Keyword(k => k.Name(ii => ii.Hash))
                        .Keyword(s => s.Name(n => n.ImageUrls))
                        .Binary(a => a.Name(i => i.Thumbnail))
                )
            )
        );
    }

    public async Task<ImageItem> GetImageByHash(string hash)
    {
        var response = await _elasticClient.GetAsync<ImageItem>(hash, r => r.Index(IMAGES));
        return response.Source;
    }

    public Task StoreImage(ImageItem imageItem)
    {
        return _elasticClient.IndexAsync(imageItem, r => r.Index(IMAGES).Id(imageItem.Hash));
    }

}
