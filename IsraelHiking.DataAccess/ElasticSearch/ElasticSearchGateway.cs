using System;
using System.Collections.Generic;
using System.Globalization;
using System.Linq;
using System.Text;
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

    private const double EXACT_KEYWORD_BOOST = 12;
    private const double PREFIX_TIER_BOOST = 12;
    private const double PHRASE_PREFIX_BOOST = 8;
    private const double NAME_MATCH_BOOST = 5;
    private const double FUZZY_TIER_BOOST = 2;
    private const double EXACT_ALT_KEYWORD_BOOST = 6;
    private const double ALT_NAME_MATCH_BOOST = 3;
    private const double CONTAINER_EXACT_BOOST = 12;
    private const double CONTAINER_PHRASE_BOOST = 6;
    private const double CONTAINER_RECALL_BOOST = 1;
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
    private const double KM_PER_DEGREE_LATITUDE = 111.0;
    private const double DEFAULT_ZOOM = 12;
    private const double MAX_ZOOM = 22;
    private const double MIN_LATITUDE = -90;
    private const double MAX_LATITUDE = 90;
    private const double MIN_LONGITUDE = -180;
    private const double MAX_LONGITUDE = 180;
    private const double GEO_SCALE_KM = 8.0;

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

    private List<IFeature> HitsToFeatures(ISearchResponse<PointDocument> response, string language)
    {
        return response.Hits.Select(d => HitToFeature(d, language)).ToList();
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

    private static QueryContainer LanguageDisMax<T>(QueryContainerDescriptor<T> q, double? boost,
        Func<QueryContainerDescriptor<T>, string, QueryContainer> perLanguageQuery) where T : class =>
        q.DisMax(dm =>
        {
            dm.TieBreaker(0.0);
            if (boost is { } b)
            {
                dm.Boost(b);
            }
            return dm.Queries(Languages.ArrayWithDefault
                .Select<string, Func<QueryContainerDescriptor<T>, QueryContainer>>(l => qq => perLanguageQuery(qq, l))
                .ToArray());
        });

    private QueryContainer DocumentNameSearchQuery<T>(QueryContainerDescriptor<T> q, string searchTerm, bool prefix = false) where T : class
    {
        QueryContainer ExactNameKeywordTier(QueryContainerDescriptor<T> sh) => sh.ConstantScore(cs => cs
            .Boost(EXACT_KEYWORD_BOOST)
            .Filter(f => f.MultiMatch(m =>
                m.Type(TextQueryType.Phrase)
                .Query(searchTerm)
                .Fields(f2 => f2.Fields(
                    Languages.ArrayWithDefault.Select(l => new Field("name." + l + ".keyword"))))
            )));

        QueryContainer PrefixTier(QueryContainerDescriptor<T> sh) =>
            LanguageDisMax(sh, PREFIX_TIER_BOOST, (qq, l) => qq.Match(m => m
                .Field(new Field("name." + l + ".prefix"))
                .Query(searchTerm)
                .Operator(Operator.And)
                .Name(SearchLanguageDetector.LanguageQueryName(l, "prefix"))));

        QueryContainer PhrasePrefixTier(QueryContainerDescriptor<T> sh) =>
            LanguageDisMax(sh, PHRASE_PREFIX_BOOST, (qq, l) => qq.MatchPhrasePrefix(m => m
                .Field(new Field("name." + l))
                .Query(searchTerm)
                .MaxExpansions(200)
                .Name(SearchLanguageDetector.LanguageQueryName(l, "phrase-prefix"))));

        QueryContainer BestOfPrefixTiers(QueryContainerDescriptor<T> sh) => sh.DisMax(dm => dm
            .TieBreaker(0.0)
            .Queries(PrefixTier, PhrasePrefixTier));

        QueryContainer NameMatchTier(QueryContainerDescriptor<T> sh) =>
            LanguageDisMax(sh, null, (qq, l) => qq.Match(m => m
                .Field(new Field("name." + l))
                .Query(searchTerm)
                .Boost(NAME_MATCH_BOOST)
                .Name(SearchLanguageDetector.LanguageQueryName(l))));

        QueryContainer ExactAltNameKeywordTier(QueryContainerDescriptor<T> sh) => sh.ConstantScore(cs => cs
            .Boost(EXACT_ALT_KEYWORD_BOOST)
            .Filter(f => f.MultiMatch(m =>
                m.Type(TextQueryType.Phrase)
                .Query(searchTerm)
                .Fields(f2 => f2.Fields(
                    Languages.ArrayWithDefault.Select(l => new Field("alt_names." + l + ".keyword"))))
            )));

        QueryContainer AltNameMatchTier(QueryContainerDescriptor<T> sh) =>
            LanguageDisMax(sh, null, (qq, l) => qq.Match(m => m
                .Field(new Field("alt_names." + l))
                .Query(searchTerm)
                .Boost(ALT_NAME_MATCH_BOOST)
                .Name(SearchLanguageDetector.LanguageQueryName(l, "alt"))));

        QueryContainer FuzzyTypoTier(QueryContainerDescriptor<T> sh) =>
            LanguageDisMax(sh, FUZZY_TIER_BOOST, (qq, l) => qq.Match(m => m
                .Field(new Field("name." + l))
                .Query(searchTerm)
                .Fuzziness(Fuzziness.Auto)
                .Name(SearchLanguageDetector.LanguageQueryName(l, "fuzzy"))));

        var shoulds = new List<Func<QueryContainerDescriptor<T>, QueryContainer>>
        {
            ExactNameKeywordTier,
            prefix ? BestOfPrefixTiers : PhrasePrefixTier,
            NameMatchTier,
            ExactAltNameKeywordTier,
            AltNameMatchTier,
        };

        if (!prefix)
        {
            shoulds.Add(FuzzyTypoTier);
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
            .Functions(fns => SumRelevanceSignals(fns, searchTerm, center, zoom))
        );
    }

    private static IPromise<IList<IScoreFunction>> SumRelevanceSignals<T>(ScoreFunctionsDescriptor<T> fns,
        string searchTerm, (double lat, double lng)? center, double? zoom) where T : PointDocument
    {
        AddSaturatedTextScore(fns);
        AddProminenceScore(fns);

        var exactNameFilter = BuildExactNameFilter<T>(searchTerm);

        if (center is not { } mapCenter)
        {
            if (exactNameFilter != null)
            {
                fns.Weight(w => w.Filter(exactNameFilter).Weight(EXACT_NAME_BONUS));
            }
            return fns;
        }

        var beta = ZoomBeta(zoom);
        var (scaleKm, offsetKm) = ComputeGeoDecayParams(zoom);

        AddProximityToMapCenterScore(fns, mapCenter, scaleKm, offsetKm, beta);

        if (exactNameFilter != null)
        {
            AddExactNameBonusNearMapCenter(fns, exactNameFilter, mapCenter, scaleKm, offsetKm);
        }

        AddInsideViewportBoost(fns, mapCenter, zoom, beta);

        return fns;
    }

    private static void AddSaturatedTextScore<T>(ScoreFunctionsDescriptor<T> fns) where T : PointDocument
    {
        fns.ScriptScore(ss => ss.Script(s => s
            .Source("params.w_text * (_score / (_score + params.k_text))")
            .Params(new Dictionary<string, object>
            {
                ["w_text"] = WEIGHT_TEXT,
                ["k_text"] = TEXT_NORM_K,
            })));
    }

    private static void AddProminenceScore<T>(ScoreFunctionsDescriptor<T> fns) where T : PointDocument
    {
        fns.FieldValueFactor(fv => fv
            .Field(PROMINENCE_FIELD)
            .Missing(0)
            .Factor(WEIGHT_PROMINENCE));
    }

    private static Func<QueryContainerDescriptor<T>, QueryContainer> BuildExactNameFilter<T>(string searchTerm)
        where T : PointDocument
    {
        var normalized = NormalizeSearchTerm(searchTerm);
        if (string.IsNullOrEmpty(normalized))
        {
            return null;
        }
        var exactNameClauses = Languages.ArrayWithDefault
            .Select<string, Func<QueryContainerDescriptor<T>, QueryContainer>>(
                language => f => f.Term("name." + language + ".keyword", normalized))
            .ToArray();
        return f => f.Bool(b => b.Should(exactNameClauses).MinimumShouldMatch(1));
    }

    private static void AddProximityToMapCenterScore<T>(ScoreFunctionsDescriptor<T> fns,
        (double lat, double lng) mapCenter, double scaleKm, double offsetKm, double beta) where T : PointDocument
    {
        fns.GaussGeoLocation(g => g
            .Field(LOCATION_FIELD)
            .Origin(new GeoLocation(mapCenter.lat, mapCenter.lng))
            .Scale(new Distance(scaleKm, DistanceUnit.Kilometers))
            .Offset(new Distance(offsetKm, DistanceUnit.Kilometers))
            .Decay(GEO_DECAY)
            .Weight(WEIGHT_GEO * beta));
    }

    private static void AddExactNameBonusNearMapCenter<T>(ScoreFunctionsDescriptor<T> fns,
        Func<QueryContainerDescriptor<T>, QueryContainer> exactNameFilter,
        (double lat, double lng) mapCenter, double scaleKm, double offsetKm) where T : PointDocument
    {
        fns.GaussGeoLocation(g => g
            .Filter(exactNameFilter)
            .Field(LOCATION_FIELD)
            .Origin(new GeoLocation(mapCenter.lat, mapCenter.lng))
            .Scale(new Distance(scaleKm, DistanceUnit.Kilometers))
            .Offset(new Distance(offsetKm, DistanceUnit.Kilometers))
            .Decay(GEO_DECAY)
            .Weight(EXACT_NAME_BONUS));
    }

    private static void AddInsideViewportBoost<T>(ScoreFunctionsDescriptor<T> fns,
        (double lat, double lng) mapCenter, double? zoom, double beta) where T : PointDocument
    {
        var (halfLatDeg, halfLngDeg) = ComputeViewportHalfExtentDeg(ResolveZoom(zoom), mapCenter.lat);
        var boxTop = Math.Min(MAX_LATITUDE, mapCenter.lat + halfLatDeg);
        var boxBottom = Math.Max(MIN_LATITUDE, mapCenter.lat - halfLatDeg);
        var boxLeft = WrapLongitude(mapCenter.lng - halfLngDeg);
        var boxRight = WrapLongitude(mapCenter.lng + halfLngDeg);
        fns.Weight(w => w
            .Filter(f => f.GeoBoundingBox(bb => bb
                .Field(LOCATION_FIELD)
                .BoundingBox(b => b
                    .TopLeft(boxTop, boxLeft)
                    .BottomRight(boxBottom, boxRight))))
            .Weight(VIEWPORT_BOOST * beta * beta));
    }

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

    internal static double ZoomBeta(double? zoom) =>
        1.0 / (1.0 + Math.Exp(-BETA_STEEPNESS * (ResolveZoom(zoom) - BETA_MIDPOINT)));

    public static double WrapLongitude(double lng) =>
        ((lng + 180.0) % 360.0 + 360.0) % 360.0 - 180.0;

    private static (double halfLatDeg, double halfLngDeg) ComputeViewportHalfExtentDeg(double zoom, double lat)
    {
        var (_, offsetKm) = ComputeGeoDecayParams(zoom);
        var halfKm = Math.Clamp(offsetKm * 3.0, 5.0, 400.0);
        var halfLatDeg = halfKm / KM_PER_DEGREE_LATITUDE;
        var cos = Math.Max(0.2, Math.Cos(lat * Math.PI / 180.0));
        var halfLngDeg = halfKm / (KM_PER_DEGREE_LATITUDE * cos);
        return (halfLatDeg, halfLngDeg);
    }

    internal static double ResolveZoom(double? zoom) =>
        zoom is not { } value || double.IsNaN(value) || value <= 0
            ? DEFAULT_ZOOM
            : Math.Min(value, MAX_ZOOM);

    public static (double scaleKm, double offsetKm) ComputeGeoDecayParams(double? zoom)
    {
        var offsetKm = Math.Pow(2.2, 18 - ResolveZoom(zoom)) * 0.1;
        return (GEO_SCALE_KM, Math.Round(offsetKm, 3));
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

    // HM TODO: remove this once we see that the new search is working as expected in production
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
            .Query(q => LanguageDisMax(q, null, (qq, l) => qq.MatchPhrase(mp => mp
                .Field(new Field("name." + l + ".keyword"))
                .Query(searchTerm)
                .Name(SearchLanguageDetector.LanguageQueryName(l)))))
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
            .Size(1)
            .TrackScores()
            .Sort(f => f.Descending("_score").Descending(a => a.Area))
            .Query(q => q.Bool(b => b
                .Should(
                    sh => sh.ConstantScore(cs => cs
                        .Boost(CONTAINER_EXACT_BOOST)
                        .Filter(f2 => f2.MultiMatch(m => m
                            .Type(TextQueryType.Phrase)
                            .Query(place)
                            .Fields(ff => ff.Fields(
                                Languages.ArrayWithDefault.Select(l => new Field("name." + l + ".keyword"))))))),
                    sh => sh.ConstantScore(cs => cs
                        .Boost(CONTAINER_PHRASE_BOOST)
                        .Filter(f2 => f2.MultiMatch(m => m
                            .Type(TextQueryType.Phrase)
                            .Query(place)
                            .Fields(ff => ff.Fields(
                                Languages.ArrayWithDefault.Select(l => new Field("name." + l))))))),
                    sh => sh.ConstantScore(cs => cs
                        .Boost(CONTAINER_RECALL_BOOST)
                        .Filter(f2 => prefix
                            ? f2.MultiMatch(m => m
                                .Type(TextQueryType.PhrasePrefix)
                                .Query(place)
                                .MaxExpansions(200)
                                .Fields(ff => ff.Fields(
                                    Languages.ArrayWithDefault.Select(l => new Field("name." + l)))))
                            : f2.MultiMatch(m => m
                                .Type(TextQueryType.BestFields)
                                .Query(place)
                                .Fuzziness(Fuzziness.Auto)
                                .Fields(ff => ff.Fields(
                                    Languages.ArrayWithDefault.Select(l => new Field("name." + l))))))))
                .MinimumShouldMatch(1)))
        );
        LogIfScoredQueryFailed(placesResponse, nameof(SearchPlaces) + ".container", place);
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

}
