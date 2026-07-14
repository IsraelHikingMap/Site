using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using Elasticsearch.Net;
using IsraelHiking.Common;
using IsraelHiking.Common.Configuration;
using IsraelHiking.Common.Extensions;
using IsraelHiking.DataAccessInterfaces;
using IsraelHiking.DataAccessInterfaces.Repositories;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using Nest;
using NetTopologySuite.Features;
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
    private const string BBOX_CONTAINER_TEMPLATE = "bbox_container";
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

    private IFeature HitToFeature(IHit<PointDocument> d, string language)
    {
        IFeature feature = new Feature(new Point(d.Source.Location[0], d.Source.Location[1]), new AttributesTable
        {
            { FeatureAttributes.NAME, d.Source.Name.GetValueOrDefault(Languages.DEFAULT, string.Empty) },
            { FeatureAttributes.POI_SOURCE, d.Source.PoiSource },
            { FeatureAttributes.POI_ICON, d.Source.PoiIcon },
            { FeatureAttributes.POI_CATEGORY, d.Source.PoiCategory },
            { FeatureAttributes.POI_ICON_COLOR, d.Source.PoiIconColor },
            { FeatureAttributes.DESCRIPTION, d.Source.Description.GetValueOrDefault(Languages.DEFAULT, string.Empty) },
            { FeatureAttributes.POI_ID, d.Id },
            { FeatureAttributes.POI_LANGUAGE, Languages.ALL },
            { FeatureAttributes.ID, string.Join("_", d.Id.Split("_").Skip(1)) }
        });
        var searchTermLanguage = SearchLanguageDetector.GetBestMatchLanguage(d.MatchedQueries, language);
        feature.Attributes.AddOrUpdate(FeatureAttributes.SEARCH_LANGUAGE, searchTermLanguage);
        foreach (var key in d.Source.Name.Keys.Where(k => k != Languages.DEFAULT))
        {
            feature.Attributes.AddOrUpdate("name:" + key, d.Source.Name[key]);
        }
        foreach (var key in d.Source.Description.Keys.Where(k => k != Languages.DEFAULT))
        {
            feature.Attributes.AddOrUpdate("description:" + key, d.Source.Description[key]);
        }
        if (!string.IsNullOrWhiteSpace(d.Source.Image))
        {
            feature.Attributes.AddOrUpdate(FeatureAttributes.IMAGE_URL, d.Source.Image);
        }
        feature.SetLocation(new Coordinate(d.Source.Location[0], d.Source.Location[1]));
        return feature;
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

    public async Task<List<IFeature>> Search(string searchTerm, string language,
        double? lat = null, double? lng = null, double? zoom = null, bool prefix = false)
    {
        if (string.IsNullOrWhiteSpace(searchTerm))
        {
            return [];
        }
        var response = await SearchTemplate<PointDocument>(POINTS, POINTS_SEARCH_TEMPLATE,
            PointsSearchParameters(searchTerm, lat, lng, zoom, prefix));
        return response.Hits.Select(d => HitToFeature(d, language)).ToList();
    }

    public async Task<List<IFeature>> SearchExact(string searchTerm, string language)
    {
        if (string.IsNullOrWhiteSpace(searchTerm))
        {
            return [];
        }
        var response = await SearchTemplate<PointDocument>(POINTS, POINTS_SEARCH_EXACT_TEMPLATE,
            new Dictionary<string, object> { ["searchTerm"] = searchTerm });
        return response.Hits.Select(d => HitToFeature(d, language)).ToList();
    }

    public async Task<List<IFeature>> SearchPlaces(string searchTerm, string language,
        double? lat = null, double? lng = null, double? zoom = null, bool prefix = false)
    {
        var split = searchTerm.Split(',');
        var place = split.Last().Trim();
        searchTerm = string.Join(",", split.Take(split.Length - 1)).Trim();
        if (string.IsNullOrWhiteSpace(searchTerm) || string.IsNullOrWhiteSpace(place))
        {
            return [];
        }
        var placesResponse = await SearchTemplate<BBoxDocument>(BBOX, BBOX_CONTAINER_TEMPLATE,
            new Dictionary<string, object>
            {
                ["place"] = place,
                ["prefix"] = prefix
            });
        if (placesResponse.Documents.Count == 0)
        {
            return [];
        }
        var parameters = PointsSearchParameters(searchTerm, lat, lng, zoom, prefix);
        parameters["hasPlaceShape"] = true;
        parameters["placeShape"] = ToShapeParameter(placesResponse.Documents.First().BBox);
        var response = await SearchTemplate<PointDocument>(POINTS, POINTS_SEARCH_TEMPLATE, parameters);
        return response.Hits.Select(d => HitToFeature(d, language)).ToList();
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

    /// <summary>
    /// An indexed shape as GeoJSON, passed through in the [longitude, latitude] order it is stored
    /// in, for the templates that hand it to a geo_shape query using {{#toJson}}.
    /// </summary>
    private static Dictionary<string, object> ToShapeParameter(BaseBBoxShape shape) => shape switch
    {
        EnvelopeBBoxShape envelope => new() { ["type"] = shape.Type, ["coordinates"] = envelope.Coordinates },
        PolygonBBoxShape polygon => new() { ["type"] = shape.Type, ["coordinates"] = polygon.Coordinates },
        MultiPolygonBBoxShape multiPolygon => new() { ["type"] = shape.Type, ["coordinates"] = multiPolygon.Coordinates },
        _ => throw new Exception("Unsupported shape type")
    };

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
