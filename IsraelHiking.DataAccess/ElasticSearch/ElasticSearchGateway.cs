using System;
using System.Collections.Generic;
using System.Globalization;
using System.IO;
using System.Linq;
using System.Text;
using System.Text.Json;
using System.Text.RegularExpressions;
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

    private const int NUMBER_OF_RESULTS = 20;

    private const string IMAGES = "images";
    private const string POINTS = "points";
    private const string BBOX = "bbox";

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

    private static readonly Dictionary<string, (string Icon, string Color)> _featureClassIcon = new()
    {
        ["peak"] = ("icon-peak", "black"), ["hill"] = ("icon-peak", "black"),
        ["ridge"] = ("icon-peak", "black"), ["saddle"] = ("icon-peak", "black"),
        ["cliff"] = ("icon-peak", "black"), ["rock"] = ("icon-peak", "black"),
        ["canyon"] = ("icon-peak", "black"), ["plateau"] = ("icon-peak", "black"),
        ["arch"] = ("icon-peak", "black"), ["cave"] = ("icon-peak", "black"),
        ["lake"] = ("icon-tint", "#1e80e3"), ["reservoir"] = ("icon-tint", "#1e80e3"),
        ["pond"] = ("icon-tint", "#1e80e3"), ["spring"] = ("icon-tint", "#1e80e3"),
        ["wetland"] = ("icon-tint", "#1e80e3"),
        ["river"] = ("icon-river", "#1e80e3"), ["stream"] = ("icon-river", "#1e80e3"),
        ["canal"] = ("icon-river", "#1e80e3"), ["rapids"] = ("icon-river", "#1e80e3"),
        ["waterfall"] = ("icon-waterfall", "#1e80e3"),
        ["glacier"] = ("icon-tint", "#1e80e3"),
        ["bay"] = ("icon-anchor", "#1e80e3"), ["cape"] = ("icon-anchor", "#1e80e3"),
        ["beach"] = ("icon-anchor", "#1e80e3"), ["island"] = ("icon-anchor", "#1e80e3"),
        ["forest"] = ("icon-tree", "#008000"),
        ["viewpoint"] = ("icon-viewpoint", "#008000"), ["campsite"] = ("icon-campsite", "#734a08"),
        ["attraction"] = ("icon-star", "#ffb800"),
        ["city"] = ("icon-home", "black"), ["town"] = ("icon-home", "black"),
        ["village"] = ("icon-home", "black"), ["hamlet"] = ("icon-home", "black"),
        ["suburb"] = ("icon-home", "black"), ["neighbourhood"] = ("icon-home", "black"),
        ["locality"] = ("icon-home", "black"),
        ["lodging"] = ("icon-bed", "black"),
        ["food"] = ("icon-cutlery", "black"),
        ["shop"] = ("icon-shopping-cart", "black"),
        ["museum"] = ("icon-camera", "black"),
        ["religious"] = ("icon-church", "black"),
        ["education"] = ("icon-graduation-cap", "black"),
        ["medical"] = ("icon-medkit", "#d00"),
        ["government"] = ("icon-bank", "black"),
        ["sports"] = ("icon-flag", "#008000"),
        ["park"] = ("icon-tree", "#008000"),
        ["fuel"] = ("icon-automobile", "black"),
        ["parking"] = ("icon-parking", "black"),
        ["transit"] = ("icon-bus", "black"),
        ["office"] = ("icon-building", "black"),
        ["structure"] = ("icon-building", "black"),
        ["building"] = ("icon-building", "black"),
    };

    private List<IFeature> HitsToFeatures(ISearchResponse<PointDocument> response, string language)
    {
        var usable = response.Hits.Where(HasUsableLocation).ToList();
        var skipped = response.Hits.Count - usable.Count;
        if (skipped > 0)
        {
            logger.LogWarning("Skipped {Skipped} search hit(s) with a missing or malformed location", skipped);
        }
        return usable.Select(d => HitToFeature(d, language)).ToList();
    }

    private static bool HasUsableLocation(IHit<PointDocument> hit) =>
        hit.Source?.Location is { Length: >= 2 };

    private IFeature HitToFeature(IHit<PointDocument> d, string language)
    {
        var icon = d.Source.PoiIcon;
        var iconColor = d.Source.PoiIconColor;
        if (!string.IsNullOrWhiteSpace(d.Source.FeatureClass) &&
            _featureClassIcon.TryGetValue(d.Source.FeatureClass, out var fc))
        {
            icon = fc.Icon;
            iconColor = fc.Color;
        }
        IFeature feature = new Feature(new Point(d.Source.Location[0], d.Source.Location[1]), new AttributesTable
        {
            { FeatureAttributes.NAME, d.Source.Name.GetValueOrDefault(Languages.DEFAULT, string.Empty) },
            { FeatureAttributes.POI_SOURCE, d.Source.PoiSource },
            { FeatureAttributes.POI_ICON, icon },
            { FeatureAttributes.POI_CATEGORY, d.Source.PoiCategory },
            { FeatureAttributes.POI_ICON_COLOR, iconColor },
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
        if (d.Source.AltNames != null)
        {
            foreach (var key in d.Source.AltNames.Keys)
            {
                var values = d.Source.AltNames[key];
                if (values == null || values.Count == 0)
                {
                    continue;
                }
                var attrKey = key == Languages.DEFAULT ? "alt_name" : "alt_name:" + key;
                feature.Attributes.AddOrUpdate(attrKey, string.Join("; ", values));
            }
        }
        if (!string.IsNullOrWhiteSpace(d.Source.Image))
        {
            feature.Attributes.AddOrUpdate(FeatureAttributes.IMAGE_URL, d.Source.Image);
        }
        feature.SetLocation(new Coordinate(d.Source.Location[0], d.Source.Location[1]));
        return feature;
    }

    private const double EXACT_KEYWORD_BOOST = 12;
    private const double PREFIX_TIER_BOOST = 12;
    private const double PHRASE_PREFIX_BOOST = 8;
    private const double NAME_MATCH_BOOST = 5;
    private const double FUZZY_TIER_BOOST = 2;

    private const double EXACT_ALT_KEYWORD_BOOST = 6;
    private const double ALT_NAME_MATCH_BOOST = 3;

    private QueryContainer DocumentNameSearchQuery<T>(QueryContainerDescriptor<T> q, string searchTerm, bool prefix = false) where T : class
    {
        Func<QueryContainerDescriptor<T>, QueryContainer> phrasePrefixQuery = sh => sh.MultiMatch(m =>
            m.Type(TextQueryType.PhrasePrefix)
            .Query(searchTerm)
            .MaxExpansions(200)
            .Boost(PHRASE_PREFIX_BOOST)
            .Fields(f => f.Fields(
                Languages.ArrayWithDefault.Select(l => new Field("name." + l)))));

        var shoulds = new List<Func<QueryContainerDescriptor<T>, QueryContainer>>
        {
            sh => sh.ConstantScore(cs => cs
                .Boost(EXACT_KEYWORD_BOOST)
                .Filter(f => f.MultiMatch(m =>
                    m.Type(TextQueryType.Phrase)
                    .Query(searchTerm)
                    .Fields(f2 => f2.Fields(
                        Languages.ArrayWithDefault.Select(l => new Field("name." + l + ".keyword"))))
                ))
            ),

            prefix
                ? sh => sh.DisMax(dm => dm
                    .TieBreaker(0.0)
                    .Queries(
                        qq => qq.DisMax(inner => inner
                            .TieBreaker(0.0)
                            .Boost(PREFIX_TIER_BOOST)
                            .Queries(Languages.ArrayWithDefault.Select<string, Func<QueryContainerDescriptor<T>, QueryContainer>>(
                                l => qi => qi.Match(m => m
                                    .Field(new Field("name." + l + ".prefix"))
                                    .Query(searchTerm))).ToArray())),
                        phrasePrefixQuery))
                : phrasePrefixQuery
        };

        shoulds.Add(sh => sh.DisMax(dm => dm
            .TieBreaker(0.0)
            .Queries(Languages.ArrayWithDefault.Select<string, Func<QueryContainerDescriptor<T>, QueryContainer>>(
                l => qq => qq.Match(m => m
                    .Field(new Field("name." + l))
                    .Query(searchTerm)
                    .Boost(NAME_MATCH_BOOST)
                    .Name(SearchLanguageDetector.LanguageQueryName(l)))).ToArray())));

        shoulds.Add(sh => sh.ConstantScore(cs => cs
            .Boost(EXACT_ALT_KEYWORD_BOOST)
            .Filter(f => f.MultiMatch(m =>
                m.Type(TextQueryType.Phrase)
                .Query(searchTerm)
                .Fields(f2 => f2.Fields(
                    Languages.ArrayWithDefault.Select(l => new Field("alt_names." + l + ".keyword"))))
            ))
        ));

        shoulds.Add(sh => sh.DisMax(dm => dm
            .TieBreaker(0.0)
            .Queries(Languages.ArrayWithDefault.Select<string, Func<QueryContainerDescriptor<T>, QueryContainer>>(
                l => qq => qq.Match(m => m
                    .Field(new Field("alt_names." + l))
                    .Query(searchTerm)
                    .Boost(ALT_NAME_MATCH_BOOST))).ToArray())));

        if (!prefix)
        {
            shoulds.Add(sh => sh.MultiMatch(m =>
                m.Type(TextQueryType.BestFields)
                .Query(searchTerm)
                .Fuzziness(Fuzziness.Auto)
                .Boost(FUZZY_TIER_BOOST)
                .Fields(f => f.Fields(
                    Languages.ArrayWithDefault.Select(l => new Field("name." + l))))));
        }

        return q.Bool(b => b
            .Should(shoulds.ToArray())
            .MinimumShouldMatch(1)
        );
    }

    private QueryContainer NameSearchWithScoring<T>(QueryContainerDescriptor<T> q, string searchTerm,
        double? lat, double? lng, double? zoom, bool prefix) where T : PointDocument
    {
        var center = ResolveMapCenter(lat, lng);

        return q.FunctionScore(fs => fs
            .Query(qq => DocumentNameSearchQuery(qq, searchTerm, prefix))
            .ScoreMode(FunctionScoreMode.Sum)
            .BoostMode(FunctionBoostMode.Replace)
            .Functions(fns => BuildScoreFunctions(fns, searchTerm, center, zoom))
        );
    }

    private static IPromise<IList<IScoreFunction>> BuildScoreFunctions<T>(ScoreFunctionsDescriptor<T> fns,
        string searchTerm, (double lat, double lng)? center, double? zoom) where T : PointDocument
    {
        fns.ScriptScore(ss => ss.Script(s => s
            .Source("params.w_text * (_score / (_score + params.k_text))")
            .Params(new Dictionary<string, object>
            {
                ["w_text"] = WEIGHT_TEXT,
                ["k_text"] = TEXT_NORM_K,
            })));

        fns.FieldValueFactor(fv => fv
            .Field(PROMINENCE_FIELD)
            .Missing(0)
            .Factor(WEIGHT_PROMINENCE));

        var exactNameClauses = Languages.ArrayWithDefault
            .Select(language => (language, normalized: NormalizeForKeyword(searchTerm, isHebrew: language == Languages.HEBREW)))
            .Where(x => !string.IsNullOrEmpty(x.normalized))
            .Select<(string language, string normalized), Func<QueryContainerDescriptor<T>, QueryContainer>>(
                x => f => f.Term("name." + x.language + ".keyword", x.normalized))
            .ToArray();
        if (exactNameClauses.Length > 0)
        {
            fns.Weight(w => w
                .Filter(f => f.Bool(b => b.Should(exactNameClauses).MinimumShouldMatch(1)))
                .Weight(EXACT_NAME_BONUS));
        }

        if (center is not { } mapCenter)
        {
            return fns;
        }

        var beta = ZoomBeta(zoom);
        var (scaleKm, offsetKm) = ComputeGeoDecayParams(zoom);

        fns.GaussGeoLocation(g => g
            .Field(LOCATION_FIELD)
            .Origin(new GeoLocation(mapCenter.lat, mapCenter.lng))
            .Scale(new Distance(scaleKm, DistanceUnit.Kilometers))
            .Offset(new Distance(offsetKm, DistanceUnit.Kilometers))
            .Decay(GEO_DECAY)
            .Weight(WEIGHT_GEO * beta));

        var (halfLatDeg, halfLngDeg) = ComputeViewportHalfExtentDeg(ResolveZoom(zoom), mapCenter.lat);
        var boxTop = Math.Min(MAX_LATITUDE, mapCenter.lat + halfLatDeg);
        var boxBottom = Math.Max(MIN_LATITUDE, mapCenter.lat - halfLatDeg);
        var boxLeft = Math.Max(MIN_LONGITUDE, mapCenter.lng - halfLngDeg);
        var boxRight = Math.Min(MAX_LONGITUDE, mapCenter.lng + halfLngDeg);
        fns.Weight(w => w
            .Filter(f => f.GeoBoundingBox(bb => bb
                .Field(LOCATION_FIELD)
                .BoundingBox(b => b
                    .TopLeft(boxTop, boxLeft)
                    .BottomRight(boxBottom, boxRight))))
            .Weight(VIEWPORT_BOOST * beta * beta));

        return fns;
    }

    internal static (double lat, double lng)? ResolveMapCenter(double? lat, double? lng)
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

    private const double VIEWPORT_BOOST = 0.15;

    private const string LOCATION_FIELD = "location";
    private const string PROMINENCE_FIELD = "poiProminence";

    private const double WEIGHT_TEXT = 0.5;
    private const double WEIGHT_GEO = 1.0;
    private const double WEIGHT_PROMINENCE = 0.3;
    private const double EXACT_NAME_BONUS = 0.10;

    private const double TEXT_NORM_K = 20.0;

    private const double BETA_MIDPOINT = 8.0;
    private const double BETA_STEEPNESS = 0.7;

    private static readonly double GEO_DECAY = Math.Exp(-0.5);

    internal static double ZoomBeta(double? zoom) =>
        1.0 / (1.0 + Math.Exp(-BETA_STEEPNESS * (ResolveZoom(zoom) - BETA_MIDPOINT)));

    private const double KM_PER_DEGREE_LATITUDE = 111.0;

    private static (double halfLatDeg, double halfLngDeg) ComputeViewportHalfExtentDeg(double zoom, double lat)
    {
        var (_, offsetKm) = ComputeGeoDecayParams(zoom);
        var halfKm = Math.Clamp(offsetKm * 3.0, 5.0, 400.0);
        var halfLatDeg = halfKm / KM_PER_DEGREE_LATITUDE;
        var cos = Math.Max(0.2, Math.Cos(lat * Math.PI / 180.0));
        var halfLngDeg = halfKm / (KM_PER_DEGREE_LATITUDE * cos);
        return (halfLatDeg, halfLngDeg);
    }

    private const double DEFAULT_ZOOM = 12;

    private const double MAX_ZOOM = 22;

    private const double MIN_LATITUDE = -90;
    private const double MAX_LATITUDE = 90;
    private const double MIN_LONGITUDE = -180;
    private const double MAX_LONGITUDE = 180;

    internal static double ResolveZoom(double? zoom) =>
        zoom is not { } value || double.IsNaN(value) || value <= 0
            ? DEFAULT_ZOOM
            : Math.Min(value, MAX_ZOOM);

    internal static (double scaleKm, double offsetKm) ComputeGeoDecayParams(double? zoom)
    {
        var resolvedZoom = ResolveZoom(zoom);
        var offsetKm = Math.Pow(2.2, 18 - resolvedZoom) * 0.1;
        var scaleKm = Math.Max(8.0, 0.4 * (resolvedZoom - 3));
        return (Math.Round(scaleKm, 3), Math.Round(offsetKm, 3));
    }

    public async Task<List<IFeature>> Search(string searchTerm, string language,
        double? lat = null, double? lng = null, double? zoom = null, bool prefix = false)
    {
        if (string.IsNullOrWhiteSpace(searchTerm))
        {
            return [];
        }
        searchTerm = NormalizeSearchTerm(searchTerm);

        var response = await _elasticClient.SearchAsync<PointDocument>(s => s.Index(POINTS)
            .Size(NUMBER_OF_RESULTS)
            .TrackScores()
            .Sort(f => f.Descending("_score"))
            .Query(q => NameSearchWithScoring(q, searchTerm, lat, lng, zoom, prefix))
        );
        LogIfScoredQueryFailed(response, nameof(Search), searchTerm);
        return HitsToFeatures(response, language);
    }

    private void LogIfScoredQueryFailed<T>(ISearchResponse<T> response, string operation, string searchTerm) where T : class
    {
        if (!response.IsValid)
        {
            var reason = response.ServerError?.ToString()
                ?? response.OriginalException?.ToString()
                ?? "unknown failure (no ServerError, no OriginalException)";
            logger.LogError("Scored {Operation}('{Term}') failed: {Err}", operation, searchTerm, reason);
            return;
        }
        var shards = response.Shards;
        if (shards is not null && shards.Failed > 0)
        {
            logger.LogWarning(
                "Scored {Operation}('{Term}') succeeded on {Successful}/{Total} shards; {Failed} failed, results are partial",
                operation, searchTerm, shards.Successful, shards.Total, shards.Failed);
        }
    }

    public async Task<List<IFeature>> SearchExact(string searchTerm, string language)
    {
        if (string.IsNullOrWhiteSpace(searchTerm))
        {
            return [];
        }
        searchTerm = NormalizeSearchTerm(searchTerm);
        var response = await _elasticClient.SearchAsync<PointDocument>(s => s.Index(POINTS)
            .Size(NUMBER_OF_RESULTS)
            .TrackScores()
            .Sort(f => f.Descending("_score").Field(ff => ff.Field("poiProminence").Descending().UnmappedType(FieldType.Float)))
            .Query(q => q.DisMax(dm => dm
                .TieBreaker(0.0)
                .Queries(Languages.ArrayWithDefault.Select<string, Func<QueryContainerDescriptor<PointDocument>, QueryContainer>>(
                    l => qq => qq.MatchPhrase(mp => mp
                        .Field(new Field("name." + l + ".keyword"))
                        .Query(searchTerm)
                        .Name(SearchLanguageDetector.LanguageQueryName(l)))).ToArray())))
        );
        LogIfScoredQueryFailed(response, nameof(SearchExact), searchTerm);
        return HitsToFeatures(response, language);
    }

    public async Task<List<IFeature>> SearchPlaces(string searchTerm, string language,
        double? lat = null, double? lng = null, double? zoom = null, bool prefix = false)
    {
        var split = searchTerm.Split(',');
        var place = NormalizeSearchTerm(split.Last().Trim());
        searchTerm = NormalizeSearchTerm(string.Join(",", split.Take(split.Length - 1)).Trim());
        if (string.IsNullOrWhiteSpace(searchTerm) || string.IsNullOrWhiteSpace(place))
        {
            return [];
        }
        var placesResponse = await _elasticClient.SearchAsync<BBoxDocument>(s => s.Index(BBOX)
            .Size(20)
            .TrackScores()
            .Sort(f => f.Descending(a => a.Area))
            .Query(q => q.MultiMatch(m => m
                .Type(TextQueryType.Phrase)
                .Query(place)
                .Fields(f2 => f2.Fields(
                    Languages.ArrayWithDefault.Select(l => new Field("name." + l))))))
        );
        LogIfScoredQueryFailed(placesResponse, nameof(SearchPlaces) + ".container", place);
        if (placesResponse.Documents.Count == 0)
        {
            placesResponse = await _elasticClient.SearchAsync<BBoxDocument>(s => s.Index(BBOX)
                .Size(1)
                .TrackScores()
                .Sort(f => f.Descending("_score"))
                .Query(q => DocumentNameSearchQuery(q, place))
            );
            LogIfScoredQueryFailed(placesResponse, nameof(SearchPlaces) + ".containerFallback", place);
        }
        if (placesResponse.Documents.Count == 0)
        {
            return [];
        }
        var response = await _elasticClient.SearchAsync<PointDocument>(s => s.Index(POINTS)
            .Size(NUMBER_OF_RESULTS)
            .TrackScores()
            .Sort(f => f.Descending("_score"))
            .Query(q => NameSearchWithScoring(q, searchTerm, lat, lng, zoom, prefix) &&
                q.GeoShape(b =>
                {
                    b.Field(p => p.Location);
                    b.Relation(GeoShapeRelation.Within);
                    return placesResponse.Documents.First().BBox switch
                    {
                        EnvelopeBBoxShape envelope => b.Shape(sh =>
                                sh.Envelope(envelope.Coordinates.Select(c => new GeoCoordinate(c[1], c[0])))),
                        PolygonBBoxShape poly => b.Shape(sh =>
                            sh.Polygon(poly.Coordinates.Select(
                                p => p.Select(c => new GeoCoordinate(c[1], c[0]))))),
                        MultiPolygonBBoxShape multi => b.Shape(sh =>
                            sh.MultiPolygon(multi.Coordinates.Select(mp =>
                                mp.Select(p => p.Select(c => new GeoCoordinate(c[1], c[0])))))),
                        _ => throw new Exception("Unsupported shape type")
                    };
                })
            )
        );
        LogIfScoredQueryFailed(response, nameof(SearchPlaces), searchTerm);
        return HitsToFeatures(response, language);
    }

    public async Task<string> GetContainerName(Coordinate[] coordinates, string language)
    {
        var response = await _elasticClient.SearchAsync<BBoxDocument>(
            s => s.Index(BBOX)
                .Size(1)
                .Sort(f => f.Ascending(a => a.Area))
                .Query(q =>
                    q.GeoShape(g =>
                        g.Shape(sh =>
                            {
                                if (coordinates.Length == 1)
                                {
                                    return sh.Point(ConvertCoordinate(coordinates[0]));
                                }

                                return sh.Envelope([
                                    new GeoCoordinate(coordinates.Max(c => c.Y), coordinates.Min(c => c.X)),
                                    new GeoCoordinate(coordinates.Min(c => c.Y), coordinates.Max(c => c.X))
                                ]);

                            })
                            // For some reason the field is not recognized as a field
                            .Field("bbox")
                            .Relation(GeoShapeRelation.Contains))
                )
        );
        var document = response.Documents.FirstOrDefault();
        return document?.Name.GetValueOrDefault(language, document.Name.GetValueOrDefault(Languages.ENGLISH, document.Name.GetValueOrDefault(Languages.DEFAULT, string.Empty)));
    }

    private GeoCoordinate ConvertCoordinate(Coordinate coordinate)
    {
        return new GeoCoordinate(coordinate.Y, coordinate.X);
    }

    private Task CreateImagesIndex()
    {
        return _elasticClient.Indices.CreateAsync(IMAGES, c =>
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

    private static string NormalizeSearchTerm(string input)
    {
        if (string.IsNullOrEmpty(input)) return input;
        // Strip niqqud (U+05B0-U+05C7) and other non-spacing marks (accents etc.)
        return string.Concat(
            input.Normalize(NormalizationForm.FormD)
                 .Where(c => c < '\u05B0' || c > '\u05C7')
                 .Where(c => CharUnicodeInfo.GetUnicodeCategory(c)
                             != UnicodeCategory.NonSpacingMark)
        ).Normalize(NormalizationForm.FormC)
         .ToLowerInvariant();
    }

    private const string HebrewVav = "\u05D5";
    private const string HebrewYod = "\u05D9";

    private static string ApplyHebrewMatresDoubledOnly(string input)
    {
        if (string.IsNullOrEmpty(input)) return input;
        return input
            .Replace("\u05D5\u05D5", HebrewVav)
            .Replace("\u05D9\u05D9", HebrewYod);
    }

    internal static string NormalizeForKeyword(string input, bool isHebrew)
    {
        if (string.IsNullOrEmpty(input)) return input;
        if (!isHebrew)
        {
            return NormalizeSearchTerm(input);
        }
        var niqqudStripped = string.Concat(
            input.Normalize(NormalizationForm.FormD)
                 .Where(c => c < '\u05B0' || c > '\u05C7')
                 .Where(c => CharUnicodeInfo.GetUnicodeCategory(c)
                             != UnicodeCategory.NonSpacingMark)
        ).Normalize(NormalizationForm.FormC);
        return ApplyHebrewMatresDoubledOnly(niqqudStripped).ToLowerInvariant();
    }
}
