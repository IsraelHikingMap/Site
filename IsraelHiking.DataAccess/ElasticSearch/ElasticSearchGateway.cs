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
using YamlDotNet.Core;
using YamlDotNet.Core.Events;
using YamlDotNet.Serialization;

namespace IsraelHiking.DataAccess.ElasticSearch;

public class ElasticSearchGateway(IOptions<ConfigurationData> options, ILogger logger) :
    IInitializable,
    IPointsOfInterestRepository,
    ISearchRepository,
    IImagesRepository,
    IExternalSourcesRepository
{
    private readonly ConfigurationData _options = options.Value;

    private const int PAGE_SIZE = 10000;
    private const int NUMBER_OF_RESULTS = 20;

    private const string PROPERTIES = "properties";
    private const string EXTERNAL_POIS = "external_pois";
    private const string IMAGES = "images";
    private const string REBUILD_LOG = "rebuild_log";
    private const string POINTS = "points";
    private const string BBOX = "bbox";

    // When set, the search path carries extra ranking signals as feature attributes for the debug response.
    internal static bool DebugSearch { get; set; } =
        (Environment.GetEnvironmentVariable("DEBUG_SEARCH") ?? "")
            .Trim().ToLowerInvariant() is "true" or "1" or "yes";

    private IElasticClient _elasticClient;

    // Infer double/long/bool from untyped scalars; default makes every param a string and fails painless casts.
    private static readonly IDeserializer _scoringYamlDeserializer = new DeserializerBuilder()
        .WithNamingConvention(YamlDotNet.Serialization.NamingConventions.LowerCaseNamingConvention.Instance)
        .WithNodeDeserializer(new ScalarTypeInferringNodeDeserializer())
        .Build();

    // Infer numeric/bool CLR types from untyped YAML scalars into `object` targets; typed targets fall through.
    private sealed class ScalarTypeInferringNodeDeserializer : YamlDotNet.Serialization.INodeDeserializer
    {
        public bool Deserialize(IParser parser, Type expectedType,
            Func<IParser, Type, object> nestedObjectDeserializer, out object value,
            ObjectDeserializer rootDeserializer)
        {
            if (expectedType != typeof(object) || !parser.TryConsume<Scalar>(out var scalar))
            {
                value = null;
                return false;
            }
            // A quoted scalar is an explicit string.
            if (scalar.Style is ScalarStyle.SingleQuoted or ScalarStyle.DoubleQuoted)
            {
                value = scalar.Value;
                return true;
            }
            var s = scalar.Value;
            if (s == "null" || s == "~" || s.Length == 0)
            {
                value = null;
            }
            else if (s == "true" || s == "false")
            {
                value = s == "true";
            }
            else if (long.TryParse(s, NumberStyles.Integer, CultureInfo.InvariantCulture, out var l))
            {
                value = l;
            }
            else if (double.TryParse(s, NumberStyles.Float, CultureInfo.InvariantCulture, out var d))
            {
                value = d;
            }
            else
            {
                value = s;
            }
            return true;
        }
    }

    public async Task Initialize()
    {
        var uri = _options.ElasticsearchServerAddress;
        var pool = new SingleNodeConnectionPool(new Uri(uri));
        var connectionString = new ConnectionSettings(
                pool,
                new HttpConnection(),
                (_, _) => new SystemTextJsonSerializer(GeoJsonExtensions.GeoJsonWritableFactory))
            .PrettyJson();
        _elasticClient = new ElasticClient(connectionString);
        if ((await _elasticClient.Indices.ExistsAsync(IMAGES)).Exists == false)
        {
            await CreateImagesIndex();
        }
        logger.LogInformation("Finished initialing elasticsearch with uri: " + uri);
    }

    private List<IHit<T>> GetAllItemsByScrolling<T>(ISearchResponse<T> response) where T : class
    {
        var list = new List<IHit<T>>();
        list.AddRange(response.Hits.ToList());
        var results = _elasticClient.Scroll<T>("10s", response.ScrollId);
        list.AddRange(results.Hits.ToList());
        while (results.Documents.Any())
        {
            results = _elasticClient.Scroll<T>("10s", results.ScrollId);
            list.AddRange(results.Hits.ToList());
        }
        _elasticClient.ClearScroll(new ClearScrollRequest(response.ScrollId));
        return list;
    }

    /// <summary>Best matched language from the named "lang:&lt;l&gt;" sub-queries in hit.MatchedQueries, else fallback.</summary>
    private string GetBestMatchLanguage(IReadOnlyCollection<string> matchedQueries, string fallbackLanguage)
        => SearchLanguageDetector.GetBestMatchLanguage(matchedQueries, fallbackLanguage);

    /// <summary>Named-query label for a per-language phrase clause, e.g. "lang:en".</summary>
    private static string LanguageQueryName(string language) => SearchLanguageDetector.LanguageQueryName(language);

    // feature_class -> autocomplete icon override at query time (more specific than the baked poiIcon,
    // no reindex). Only glyphs present in the web font (src/fonts/icons.css) are used; missing types
    // reuse the nearest glyph. Absent class keeps the baked poiIcon verbatim.
    private static readonly Dictionary<string, (string Icon, string Color)> _featureClassIcon = new()
    {
        // peaks / high ground (black)
        ["peak"] = ("icon-peak", "black"), ["hill"] = ("icon-peak", "black"),
        ["ridge"] = ("icon-peak", "black"), ["saddle"] = ("icon-peak", "black"),
        ["cliff"] = ("icon-peak", "black"), ["rock"] = ("icon-peak", "black"),
        // terrain landforms — reuse icon-peak
        ["canyon"] = ("icon-peak", "black"), ["plateau"] = ("icon-peak", "black"),
        ["arch"] = ("icon-peak", "black"), ["cave"] = ("icon-peak", "black"),
        // standing water (blue)
        ["lake"] = ("icon-tint", "#1e80e3"), ["reservoir"] = ("icon-tint", "#1e80e3"),
        ["pond"] = ("icon-tint", "#1e80e3"), ["spring"] = ("icon-tint", "#1e80e3"),
        ["wetland"] = ("icon-tint", "#1e80e3"),
        // flowing water (blue)
        ["river"] = ("icon-river", "#1e80e3"), ["stream"] = ("icon-river", "#1e80e3"),
        ["canal"] = ("icon-river", "#1e80e3"), ["rapids"] = ("icon-river", "#1e80e3"),
        ["waterfall"] = ("icon-waterfall", "#1e80e3"),
        // ice / coast (blue) — reuse nearest glyph
        ["glacier"] = ("icon-tint", "#1e80e3"),
        ["bay"] = ("icon-anchor", "#1e80e3"), ["cape"] = ("icon-anchor", "#1e80e3"),
        ["beach"] = ("icon-anchor", "#1e80e3"), ["island"] = ("icon-anchor", "#1e80e3"),
        // land cover (green)
        ["forest"] = ("icon-tree", "#008000"),
        // recreation / POI
        ["viewpoint"] = ("icon-viewpoint", "#008000"), ["campsite"] = ("icon-campsite", "#734a08"),
        ["attraction"] = ("icon-star", "#ffb800"),
        // populated places (black)
        ["city"] = ("icon-home", "black"), ["town"] = ("icon-home", "black"),
        ["village"] = ("icon-home", "black"), ["hamlet"] = ("icon-home", "black"),
        ["suburb"] = ("icon-home", "black"), ["neighbourhood"] = ("icon-home", "black"),
        ["locality"] = ("icon-home", "black"),
        // built / POI
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
        var searchTermLanguage = GetBestMatchLanguage(d.MatchedQueries, language);
        feature.Attributes.AddOrUpdate(FeatureAttributes.SEARCH_LANGUAGE, searchTermLanguage);
        // DEBUG_SEARCH only: surface raw ranking signals as feature attributes (off in production).
        if (DebugSearch)
        {
            if (!string.IsNullOrWhiteSpace(d.Source.FeatureClass))
            {
                feature.Attributes.AddOrUpdate(FeatureAttributes.FEATURE_CLASS, d.Source.FeatureClass);
            }
            if (d.Source.Prominence.HasValue)
            {
                feature.Attributes.AddOrUpdate(FeatureAttributes.PROMINENCE, d.Source.Prominence.Value);
            }
            // Final script_score, raw BM25 sub-score, and the explain tree for the debug response.
            if (d.Score.HasValue)
            {
                feature.Attributes.AddOrUpdate(FeatureAttributes.SCORE, d.Score.Value);
            }
            if (d.Explanation != null)
            {
                var bm25 = ExtractBm25(d.Explanation);
                if (bm25.HasValue)
                {
                    feature.Attributes.AddOrUpdate(FeatureAttributes.BM25, bm25.Value);
                }
                feature.Attributes.AddOrUpdate(FeatureAttributes.EXPLAIN, ExplanationToObject(d.Explanation));
            }
        }
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
                var attrKey = key == Languages.DEFAULT ? "alt_name" : "alt_name:" + key;
                feature.Attributes.AddOrUpdate(attrKey, string.Join("; ", d.Source.AltNames[key]));
            }
        }
        if (!string.IsNullOrWhiteSpace(d.Source.Image))
        {
            feature.Attributes.AddOrUpdate(FeatureAttributes.IMAGE_URL, d.Source.Image);
        }
        feature.SetLocation(new Coordinate(d.Source.Location[0], d.Source.Location[1]));
        return feature;
    }

    // Walk the explain tree to the script/function-score node and return its inner BM25 child; fall back to root.
    private static double? ExtractBm25(Explanation explanation)
    {
        if (explanation.Details == null)
        {
            return explanation.Value;
        }
        var rootDesc = explanation.Description ?? string.Empty;
        if ((rootDesc.Contains("script", System.StringComparison.OrdinalIgnoreCase) ||
             rootDesc.Contains("function score", System.StringComparison.OrdinalIgnoreCase)) &&
            explanation.Details.Count > 0)
        {
            return explanation.Details.First().Value;
        }
        ExplanationDetail node = explanation.Details.FirstOrDefault();
        for (var depth = 0; node != null && depth < 6; depth++)
        {
            var desc = node.Description ?? string.Empty;
            if (desc.Contains("script", System.StringComparison.OrdinalIgnoreCase) ||
                desc.Contains("function score", System.StringComparison.OrdinalIgnoreCase))
            {
                var inner = node.Details?.FirstOrDefault();
                if (inner != null)
                {
                    return inner.Value;
                }
            }
            node = node.Details?.FirstOrDefault();
        }
        return explanation.Value;  // best-effort fallback
    }

    // Convert the NEST explain tree into a plain nested {value, description, details} object (depth-bounded).
    private static object ExplanationToObject(Explanation explanation, int depth = 0)
    {
        if (explanation == null || depth > 8)
        {
            return null;
        }
        return new
        {
            value = explanation.Value,
            description = explanation.Description,
            details = explanation.Details == null || explanation.Details.Count == 0
                ? null
                : explanation.Details.Select(c => DetailToObject(c, depth + 1)).ToList()
        };
    }

    private static object DetailToObject(ExplanationDetail detail, int depth)
    {
        if (detail == null || depth > 8)
        {
            return null;
        }
        return new
        {
            value = detail.Value,
            description = detail.Description,
            details = detail.Details == null || detail.Details.Count == 0
                ? null
                : detail.Details.Select(c => DetailToObject(c, depth + 1)).ToList()
        };
    }

    // Tier-1 exact-keyword boost; kept above lower tiers (8/5/2) but small enough that prominence/distance break ties.
    private const double EXACT_KEYWORD_BOOST = 12;

    // alt_name (variant-name) tier boosts, STRICTLY below their primary counterparts (6 < 12, 3 < 5).
    private const double EXACT_ALT_KEYWORD_BOOST = 6;
    private const double ALT_NAME_MATCH_BOOST = 3;

    /// <summary>Tiered name query; when <paramref name="prefix"/> the starts-with tier is emphasised and fuzzy dropped.</summary>
    private QueryContainer DocumentNameSearchQuery<T>(QueryContainerDescriptor<T> q, string searchTerm, bool prefix = false) where T : class
    {
        var shoulds = new List<Func<QueryContainerDescriptor<T>, QueryContainer>>
        {
            // Tier 1: Exact keyword match — modest lead so prominence/distance can break ties.
            sh => sh.ConstantScore(cs => cs
                .Boost(EXACT_KEYWORD_BOOST)
                .Filter(f => f.MultiMatch(m =>
                    m.Type(TextQueryType.Phrase)
                    .Query(searchTerm)
                    .Fields(f2 => f2.Fields(
                        Languages.ArrayWithDefault.Select(l => new Field("name." + l + ".keyword"))))
                ))
            ),

            // Tier 2: Prefix / "starts with", mode-gated on `prefix`:
            //   • prefix==true (mid-typing): edge-ngram match over name.<l>.prefix in a dis_max (best single lang).
            //   • prefix==false (completed term): match_phrase_prefix over name.<l>, keeps token order so a
            //     longer exact name isn't undercut by a shorter bag-of-words tie. MaxExpansions(200).
            prefix
                ? sh => sh.DisMax(dm => dm
                    .TieBreaker(0.0)
                    .Boost(12)
                    .Queries(Languages.ArrayWithDefault.Select<string, Func<QueryContainerDescriptor<T>, QueryContainer>>(
                        l => qq => qq.Match(m => m
                            .Field(new Field("name." + l + ".prefix"))
                            .Query(searchTerm))).ToArray()))
                : sh => sh.MultiMatch(m =>
                    m.Type(TextQueryType.PhrasePrefix)
                    .Query(searchTerm)
                    .MaxExpansions(200)
                    .Boost(8)
                    .Fields(f => f.Fields(
                        Languages.ArrayWithDefault.Select(l => new Field("name." + l)))))
        };

        // Tier 3: per-language name match in a dis_max (TieBreaker 0.0 = pure max), so a doc scores by its
        // single best language, not N× for being populated in N subfields. Each clause is .Name("lang:<l>")
        // so the matched language is recoverable from hit.MatchedQueries (dis_max reports all matched clauses).
        shoulds.Add(sh => sh.DisMax(dm => dm
            .TieBreaker(0.0)
            .Queries(Languages.ArrayWithDefault.Select<string, Func<QueryContainerDescriptor<T>, QueryContainer>>(
                l => qq => qq.Match(m => m
                    .Field(new Field("name." + l))
                    .Query(searchTerm)
                    .Boost(5)
                    .Name(LanguageQueryName(l)))).ToArray())));

        // ---- alt_name tiers — searched over the separate alt_names.<l> field at boosts below the
        // primary name, so a variant match (e.g. "IBT") surfaces a feature but never outranks a primary match.

        // Alt Tier-1: exact-keyword on alt_names.<l>.keyword, ConstantScore boost 6 (< primary 12).
        shoulds.Add(sh => sh.ConstantScore(cs => cs
            .Boost(EXACT_ALT_KEYWORD_BOOST)
            .Filter(f => f.MultiMatch(m =>
                m.Type(TextQueryType.Phrase)
                .Query(searchTerm)
                .Fields(f2 => f2.Fields(
                    Languages.ArrayWithDefault.Select(l => new Field("alt_names." + l + ".keyword"))))
            ))
        ));

        // Alt Tier-3: per-language match on alt_names.<l>, boost 3 (< primary 5). Must be a dis_max (not a
        // flat should) to avoid across-language SUM inflation. Intentionally unnamed: language capture is
        // authoritative on the primary name only.
        shoulds.Add(sh => sh.DisMax(dm => dm
            .TieBreaker(0.0)
            .Queries(Languages.ArrayWithDefault.Select<string, Func<QueryContainerDescriptor<T>, QueryContainer>>(
                l => qq => qq.Match(m => m
                    .Field(new Field("alt_names." + l))
                    .Query(searchTerm)
                    .Boost(ALT_NAME_MATCH_BOOST))).ToArray())));

        // Tier 4: Fuzzy — only on a completed term, never while typing.
        if (!prefix)
        {
            shoulds.Add(sh => sh.MultiMatch(m =>
                m.Type(TextQueryType.BestFields)
                .Query(searchTerm)
                .Fuzziness(Fuzziness.Auto)
                .Boost(2)
                .Fields(f => f.Fields(
                    Languages.ArrayWithDefault.Select(l => new Field("name." + l))))));
        }

        return q.Bool(b => b
            .Should(shoulds.ToArray())
            .MinimumShouldMatch(1)
        );
    }

    /// <summary>Wraps the tiered name query in a function_score so prominence and map-center proximity reorder tied text hits.</summary>
    private QueryContainer NameSearchWithScoring<T>(QueryContainerDescriptor<T> q, string searchTerm,
        double? lat, double? lng, double zoom, bool prefix) where T : PointDocument
    {
        var scriptPath = Path.Combine(AppContext.BaseDirectory, "ElasticSearch", "scoring", "updated_score.yml");
        var scriptQuery = _scoringYamlDeserializer.Deserialize<ScriptScoreQuery>(File.ReadAllText(scriptPath));

        // NEST renders YamlDotNet's object-keyed nested maps as an empty `{}` (dropping weights/class_groups/
        // group_similarities), which fails the painless on every shard; normalize them to Dictionary<string,object> first.
        var scriptParams = (Dictionary<string, object>)NormalizeForNest(scriptQuery.Script.Params);
        scriptParams["lat"] = lat;
        scriptParams["lon"] = lng;
        scriptParams["zoom"] = zoom;
        scriptParams["qtype"] = InferQtype(searchTerm);
        scriptParams["query_classes"] = InferQueryClass(searchTerm);

        // Exact-name bonus: painless can't read matched_queries, so pass the keyword field list + the query
        // normalized per each field's index normalizer ("base" universal, "he" hebrew+matres) for an in-script equality test.
        scriptParams["name_keyword_fields"] = NameKeywordFields;
        scriptParams["query_norm"] = new Dictionary<string, object>
        {
            ["base"] = NormalizeForKeyword(searchTerm, isHebrew: false),
            ["he"] = NormalizeForKeyword(searchTerm, isHebrew: true),
        };

        // Supply the viewport box for the painless in-screen boost only when a map center exists.
        if (lat.HasValue && lng.HasValue)
        {
            var (halfLatDeg, halfLngDeg) = ComputeViewportHalfExtentDeg(zoom, lat.Value);
            scriptParams["viewport_boost"] = VIEWPORT_BOOST;
            scriptParams["vp_half_lat"] = halfLatDeg;
            scriptParams["vp_half_lng"] = halfLngDeg;
            scriptParams["vp_center_lat"] = lat.Value;
            scriptParams["vp_center_lng"] = lng.Value;
        }

        Func<QueryContainerDescriptor<T>, QueryContainer> textQuery =
            qq => DocumentNameSearchQuery(qq, searchTerm, prefix);

        return q.ScriptScore(ss => ss
            .Query(textQuery)
            .Script(s => s
                .Source(scriptQuery.Script.Source)
                .Params(scriptParams)
            )
        );
    }

    /// <summary>Recursively convert YamlDotNet's untyped containers into NEST-serializable maps (Dictionary&lt;string,object&gt;) and lists.</summary>
    private static object NormalizeForNest(object value)
    {
        switch (value)
        {
            case IDictionary<string, object> typed:
            {
                var result = new Dictionary<string, object>(typed.Count);
                foreach (var kv in typed)
                {
                    result[kv.Key] = NormalizeForNest(kv.Value);
                }
                return result;
            }
            case System.Collections.IDictionary map:
            {
                var result = new Dictionary<string, object>(map.Count);
                foreach (System.Collections.DictionaryEntry entry in map)
                {
                    var key = Convert.ToString(entry.Key, CultureInfo.InvariantCulture);
                    result[key] = NormalizeForNest(entry.Value);
                }
                return result;
            }
            case string s:
                return s; // string is IEnumerable — handle before the sequence case
            case System.Collections.IEnumerable seq:
            {
                var list = new List<object>();
                foreach (var item in seq)
                {
                    list.Add(NormalizeForNest(item));
                }
                return list;
            }
            default:
                return value;
        }
    }

    // Generic word -> ordered feature_class set (primary first). RHS must exist in updated_score.yml's
    // class_groups or the boost is a no-op. Kept in lockstep with the relevance harness TYPE_TOKENS.
    private static readonly Dictionary<string, string[]> _typeTokens = new()
    {
        // peaks / high ground
        ["mountain"] = new[] { "peak" }, ["mount"] = new[] { "peak" }, ["mt"] = new[] { "peak" },
        ["peak"] = new[] { "peak" }, ["summit"] = new[] { "peak" },
        ["butte"] = new[] { "peak", "hill" }, ["pinnacle"] = new[] { "peak", "rock" },
        ["dome"] = new[] { "peak" }, ["sugarloaf"] = new[] { "peak" },
        ["hill"] = new[] { "hill", "peak" }, ["knob"] = new[] { "hill", "peak" },
        ["knoll"] = new[] { "hill" }, ["mound"] = new[] { "hill" },
        ["top"] = new[] { "hill", "peak" }, ["bald"] = new[] { "hill", "peak" },
        ["ridge"] = new[] { "ridge" }, ["saddle"] = new[] { "saddle" },
        ["gap"] = new[] { "saddle" }, ["notch"] = new[] { "saddle" }, ["pass"] = new[] { "saddle" },
        // water: standing
        ["lake"] = new[] { "lake", "reservoir", "pond" }, ["pond"] = new[] { "pond", "lake" },
        ["reservoir"] = new[] { "reservoir", "lake" }, ["lagoon"] = new[] { "lake", "pond" },
        ["millpond"] = new[] { "pond", "lake" },
        // water: flowing
        ["river"] = new[] { "river", "stream" }, ["creek"] = new[] { "stream", "river" },
        ["brook"] = new[] { "stream" }, ["stream"] = new[] { "stream", "river" },
        ["run"] = new[] { "stream" }, ["branch"] = new[] { "stream" },
        ["fork"] = new[] { "stream", "river" }, ["kill"] = new[] { "stream" },
        ["bayou"] = new[] { "stream", "river" }, ["rapids"] = new[] { "rapids" },
        ["falls"] = new[] { "waterfall" }, ["waterfall"] = new[] { "waterfall" },
        ["cascade"] = new[] { "waterfall" }, ["cascades"] = new[] { "waterfall" },
        ["canal"] = new[] { "canal" },
        // springs
        ["spring"] = new[] { "spring" }, ["springs"] = new[] { "spring" }, ["geyser"] = new[] { "spring" },
        // glacier
        ["glacier"] = new[] { "glacier" }, ["icefield"] = new[] { "glacier" },
        // coast / shore
        ["island"] = new[] { "island" }, ["isle"] = new[] { "island" }, ["islet"] = new[] { "island" },
        ["key"] = new[] { "island" }, ["cay"] = new[] { "island" },
        ["bay"] = new[] { "bay" }, ["cove"] = new[] { "bay" }, ["harbor"] = new[] { "bay" },
        ["harbour"] = new[] { "bay" }, ["inlet"] = new[] { "bay" }, ["sound"] = new[] { "bay" },
        ["cape"] = new[] { "cape" }, ["point"] = new[] { "cape" }, ["head"] = new[] { "cape" },
        ["neck"] = new[] { "cape" }, ["spit"] = new[] { "cape" },
        ["beach"] = new[] { "beach" }, ["shore"] = new[] { "beach" }, ["shores"] = new[] { "beach" },
        ["strand"] = new[] { "beach" },
        // rock / cliff
        ["rock"] = new[] { "rock", "cliff" }, ["rocks"] = new[] { "rock", "cliff" },
        ["boulder"] = new[] { "rock" }, ["cliff"] = new[] { "cliff" }, ["cliffs"] = new[] { "cliff" },
        ["bluff"] = new[] { "cliff" }, ["crag"] = new[] { "cliff", "rock" }, ["ledge"] = new[] { "cliff" },
        ["palisades"] = new[] { "cliff" },
        // valley / lowland
        ["valley"] = new[] { "valley" }, ["hollow"] = new[] { "valley" }, ["canyon"] = new[] { "valley" },
        ["gorge"] = new[] { "valley" }, ["ravine"] = new[] { "valley" }, ["glen"] = new[] { "valley" },
        ["dale"] = new[] { "valley" }, ["coulee"] = new[] { "valley" },
        // vegetation / land cover
        ["forest"] = new[] { "forest" }, ["woods"] = new[] { "forest" }, ["wood"] = new[] { "forest" },
        ["grove"] = new[] { "forest" },
        // populated places
        ["city"] = new[] { "city", "town" }, ["town"] = new[] { "town", "city" },
        ["township"] = new[] { "town" }, ["village"] = new[] { "village", "town" },
        ["hamlet"] = new[] { "hamlet", "village" }, ["borough"] = new[] { "town", "suburb" },
        ["suburb"] = new[] { "suburb", "neighbourhood" },
        ["neighborhood"] = new[] { "neighbourhood", "suburb" },
        ["neighbourhood"] = new[] { "neighbourhood", "suburb" },
        // recreation / POI
        ["viewpoint"] = new[] { "viewpoint" }, ["overlook"] = new[] { "viewpoint" },
        ["lookout"] = new[] { "viewpoint" }, ["vista"] = new[] { "viewpoint" },
        ["campground"] = new[] { "campsite" }, ["campsite"] = new[] { "campsite" },
        ["camp"] = new[] { "campsite" },
        // built / POI
        // lodging
        ["hotel"] = new[] { "lodging" }, ["motel"] = new[] { "lodging" },
        ["hostel"] = new[] { "lodging" }, ["inn"] = new[] { "lodging" },
        ["lodge"] = new[] { "lodging" }, ["guesthouse"] = new[] { "lodging" },
        // food
        ["restaurant"] = new[] { "food" }, ["cafe"] = new[] { "food" },
        ["bar"] = new[] { "food" }, ["pub"] = new[] { "food" }, ["diner"] = new[] { "food" },
        // shop
        ["shop"] = new[] { "shop" }, ["store"] = new[] { "shop" },
        ["supermarket"] = new[] { "shop" }, ["market"] = new[] { "shop" },
        ["mall"] = new[] { "shop" }, ["bakery"] = new[] { "shop" }, ["pharmacy"] = new[] { "medical" },
        // culture
        ["museum"] = new[] { "museum" }, ["gallery"] = new[] { "museum" },
        ["theatre"] = new[] { "museum" }, ["theater"] = new[] { "museum" },
        ["cinema"] = new[] { "museum" },
        // civic
        ["church"] = new[] { "religious" }, ["cathedral"] = new[] { "religious" },
        ["chapel"] = new[] { "religious" }, ["mosque"] = new[] { "religious" },
        ["synagogue"] = new[] { "religious" }, ["temple"] = new[] { "religious" },
        ["monastery"] = new[] { "religious" },
        ["school"] = new[] { "education" }, ["university"] = new[] { "education" },
        ["college"] = new[] { "education" }, ["library"] = new[] { "education" },
        ["hospital"] = new[] { "medical" }, ["clinic"] = new[] { "medical" },
        ["townhall"] = new[] { "government" }, ["courthouse"] = new[] { "government" },
        // transport ("station" deliberately omitted — too often a proper name)
        ["airport"] = new[] { "transit" },
        ["parking"] = new[] { "parking" },
    };

    // Multi-word generic phrases (checked before single tokens, at head OR tail).
    private static readonly Dictionary<string, string[]> _phraseTokens = new()
    {
        ["hot spring"] = new[] { "spring" }, ["hot springs"] = new[] { "spring" },
        ["warm spring"] = new[] { "spring" }, ["warm springs"] = new[] { "spring" },
        ["mineral springs"] = new[] { "spring" },
        ["state park"] = new[] { "tourism", "attraction" },
        ["national park"] = new[] { "tourism", "attraction" },
        ["view point"] = new[] { "viewpoint" }, ["scenic overlook"] = new[] { "viewpoint" },
        ["scenic point"] = new[] { "viewpoint" },
        ["camp ground"] = new[] { "campsite" }, ["salt lake"] = new[] { "lake", "reservoir" },
    };

    private static readonly char[] _classPunct =
        " \t\"'`.,;:!?()[]{}<>-".ToCharArray();

    /// <summary>Lower-case a token and fold a trailing plural to singular, unless the plural is itself an explicit key.</summary>
    private static string NormalizeClassToken(string tok)
    {
        var t = tok.ToLowerInvariant();
        if (_typeTokens.ContainsKey(t)) return t;
        if (t.EndsWith("es") && _typeTokens.ContainsKey(t[..^2])) return t[..^2];
        if (t.EndsWith("s") && _typeTokens.ContainsKey(t[..^1])) return t[..^1];
        return t;
    }

    /// <summary>Infer the feature_class(es) a query intends (primary first), or empty when no generic type token is present.</summary>
    private List<string> InferQueryClass(string searchTerm)
    {
        if (string.IsNullOrWhiteSpace(searchTerm)) return new List<string>();

        var q = searchTerm.Trim().Trim(_classPunct).ToLowerInvariant();
        if (q.Length == 0) return new List<string>();

        var tokens = q.Split(' ', StringSplitOptions.RemoveEmptyEntries);
        if (tokens.Length == 0) return new List<string>();

        // Multi-word phrase tokens at head or tail (longest wins).
        foreach (var n in new[] { 3, 2 })
        {
            if (tokens.Length < n) continue;
            var tail = string.Join(' ', tokens[^n..]);
            if (_phraseTokens.TryGetValue(tail, out var tailClasses)) return tailClasses.ToList();
            var head = string.Join(' ', tokens[..n]);
            if (_phraseTokens.TryGetValue(head, out var headClasses)) return headClasses.ToList();
        }

        // Trailing single type token ("X Lake").
        var last = NormalizeClassToken(tokens[^1]);
        if (_typeTokens.TryGetValue(last, out var lastClasses)) return lastClasses.ToList();

        // Leading single type token ("Mount X").
        var first = NormalizeClassToken(tokens[0]);
        if (_typeTokens.TryGetValue(first, out var firstClasses)) return firstClasses.ToList();

        return new List<string>();
    }

    /// <summary>
    /// Classify a query as GENERIC (bare category word — "lake", "hot springs") vs SPECIFIC (a named
    /// feature — "Denali", "Silver Lake"); drives the painless prominence weight. GENERIC only when
    /// EVERY token (or the whole-query phrase) is a known generic term; one non-type token => SPECIFIC.
    /// </summary>
    private string InferQtype(string searchTerm)
    {
        if (string.IsNullOrWhiteSpace(searchTerm)) return "GENERIC";
        var q = searchTerm.Trim().Trim(_classPunct).ToLowerInvariant();
        if (q.Length == 0) return "GENERIC";

        var tokens = q.Split(' ', StringSplitOptions.RemoveEmptyEntries);
        if (tokens.Length == 0) return "GENERIC";

        var whole = string.Join(' ', tokens);
        if (_phraseTokens.ContainsKey(whole)) return "GENERIC";

        // GENERIC only if every token is itself a generic type token.
        foreach (var tok in tokens)
        {
            if (!_typeTokens.ContainsKey(NormalizeClassToken(tok))) return "SPECIFIC";
        }
        return "GENERIC";
    }


    private class ScriptScoreQuery
    {
        public ScriptScore Script { get; set; }
    }

    private class ScriptScore
    {
        public string Source { get; set; }
        public Dictionary<string, object> Params { get; set; }
    }


    // Small additive in-viewport boost; must not dominate the O(1) score components (text/geo/prominence/pclass).
    private const double VIEWPORT_BOOST = 0.15;

    // Half-width/height of the map viewport in degrees, derived from zoom (lat: 111 km/deg; lng: scaled by cos(lat)).
    private static (double halfLatDeg, double halfLngDeg) ComputeViewportHalfExtentDeg(double zoom, double lat)
    {
        var (_, offsetKm) = ComputeGeoDecayParams(zoom);
        var halfKm = Math.Clamp(offsetKm * 3.0, 5.0, 400.0); // a few × the plateau, bounded
        var halfLatDeg = halfKm / 111.0;
        var cos = Math.Max(0.2, Math.Cos(lat * Math.PI / 180.0));
        var halfLngDeg = halfKm / (111.0 * cos);
        return (halfLatDeg, halfLngDeg);
    }

    // Tie the geo decay radius to zoom: offset = plateau (full score), scale = distance at which score halves.
    private static (double scaleKm, double offsetKm) ComputeGeoDecayParams(double zoom)
    {
        if (zoom <= 0)
        {
            zoom = 12; // default when the client sends no usable zoom
        }
        var offsetKm = Math.Pow(2.2, 18 - zoom) * 0.1;
        var scaleKm = Math.Max(8.0, 0.4 * (zoom - 3));
        return (Math.Round(scaleKm, 3), Math.Round(offsetKm, 3));
    }

    public async Task<List<IFeature>> Search(string searchTerm, string language,
        double? lat = null, double? lng = null, double zoom = 0, bool prefix = false)
    {
        if (string.IsNullOrWhiteSpace(searchTerm))
        {
            return [];
        }
        searchTerm = NormalizeSearchTerm(searchTerm);

        var response = await _elasticClient.SearchAsync<PointDocument>(s => s.Index(POINTS)
            .Size(NUMBER_OF_RESULTS)
            .TrackScores()
            // DEBUG_SEARCH only: ask ES to explain the inner name query (off in production, no explain cost).
            .Explain(DebugSearch)
            .Sort(f => f.Descending("_score"))
            .Query(q => NameSearchWithScoring(q, searchTerm, lat, lng, zoom, prefix))
        );
        // A failed scored query otherwise returns [] silently (e.g. painless error -> 400); log so it's diagnosable.
        if (!response.IsValid && response.ServerError != null)
        {
            logger.LogError("Scored Search('{Term}') failed: {Err}", searchTerm, response.ServerError.ToString());
        }
        return response.Hits.Select(d => HitToFeature(d, language)).ToList();
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
            // Prominence is a deterministic tiebreak AFTER _score: the exact-keyword phrase match scores
            // every same-name doc identically, so without it the winner was arbitrary Lucene segment order.
            .Sort(f => f.Descending("_score").Field(ff => ff.Field(p => p.Prominence).Descending()))
            .Query(q =>
                q.MultiMatch(m =>
                    m.Type(TextQueryType.Phrase)
                        .Query(searchTerm)
                        .Fields(f => f.Fields(Languages.ArrayWithDefault.Select(l => new Field("name." + l + ".keyword"))))
                )
            )
        );
        return response.Hits.Select(d => HitToFeature(d, language)).ToList();
    }

    public async Task<List<IFeature>> SearchPlaces(string searchTerm, string language,
        double? lat = null, double? lng = null, double zoom = 0, bool prefix = false)
    {
        var split = searchTerm.Split(',');
        var place = NormalizeSearchTerm(split.Last().Trim());
        searchTerm = NormalizeSearchTerm(string.Join(",", split.Take(split.Length - 1)).Trim());
        if (string.IsNullOrWhiteSpace(searchTerm) || string.IsNullOrWhiteSpace(place))
        {
            return [];
        }
        // Container resolution: pull the phrase-matching candidates (the phrase filter drops the fuzzy
        // long tail) then pick the LARGEST by polygon area — the canonical admin/park container, rather
        // than the most text-relevant one (which can be a smaller polygon that excludes wanted features).
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
        if (placesResponse.Documents.Count == 0)
        {
            // No phrase-match container — fall back to the text-relevance pick so a typo'd/partial name still resolves.
            placesResponse = await _elasticClient.SearchAsync<BBoxDocument>(s => s.Index(BBOX)
                .Size(1)
                .TrackScores()
                .Sort(f => f.Descending("_score"))
                .Query(q => DocumentNameSearchQuery(q, place))
            );
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
        return response.Hits.Select(d => HitToFeature(d, language)).ToList();
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

    private async Task UpdateData(List<IFeature> features, string alias)
    {
        var result = await _elasticClient.BulkAsync(bulk =>
        {
            foreach (var feature in features)
            {
                bulk.Index<IFeature>(i => i.Index(alias).Document(feature).Id(feature.GetId()));
            }
            return bulk;
        });
        if (result.IsValid == false)
        {
            result.ItemsWithErrors.ToList().ForEach(i => logger.LogError($"Inserting {i.Id} failed with error: {i.Error?.Reason ?? string.Empty} caused by: {i.Error?.CausedBy?.Reason ?? string.Empty}"));
        }
    }

    private GeoCoordinate ConvertCoordinate(Coordinate coordinate)
    {
        return new GeoCoordinate(coordinate.Y, coordinate.X);
    }

    public async Task<IFeature> GetClosestPoint(Coordinate coordinate, string source, string language)
    {
        var distance = _options.ClosestPointsOfInterestThreshold;
        var response = await _elasticClient.SearchAsync<PointDocument>(s =>
            s.Index(POINTS)
            .Size(1)
            .Query(q =>
            {
                var query = q.GeoBoundingBox(b => b.BoundingBox(
                        bb => bb.TopLeft(new GeoCoordinate(coordinate.Y + distance, coordinate.X - distance))
                            .BottomRight(new GeoCoordinate(coordinate.Y - distance, coordinate.X + distance))
                    ).Field(p => p.Location))
                    && q.Bool(b => b.MustNot(mn => mn.Term(t => t.Field(p => p.PoiIcon).Value("icon-search"))));
                if (!string.IsNullOrWhiteSpace(source))
                {
                    query = query && q.Term(t => t.Field(p => p.PoiSource).Value(source.ToLower()));
                }
                return query;
            })
            .Sort(ss => ss
                .GeoDistance(g => g
                    .Field(p => p.Location)
                    .Points(new GeoCoordinate(coordinate.Y, coordinate.X))
                    .Order(SortOrder.Ascending)
                )
            )
        );
        return response.Hits.Select(d => HitToFeature(d, language ?? Languages.DEFAULT)).FirstOrDefault();

    }

    public async Task<List<IFeature>> GetAllPointsOfInterest()
    {
        await _elasticClient.Indices.RefreshAsync(POINTS);
        var response = await _elasticClient.SearchAsync<PointDocument>(s => s.Index(POINTS)
            .Size(PAGE_SIZE)
            .Scroll("10s")
            .Query(q =>
                q.Bool(b =>
                    b.MustNot(mn =>
                        mn.Term(t => t.Field(p => p.PoiIcon).Value("icon-search"))
                    )
                )
            )
        );
        var list = GetAllItemsByScrolling(response);
        return list.Select(h => HitToFeature(h, Languages.DEFAULT)).ToList();
    }

    public async Task<List<IFeature>> GetExternalPoisBySource(string source)
    {
        var response = await _elasticClient.SearchAsync<IFeature>(
            s => s.Index(EXTERNAL_POIS)
                .Size(10000)
                .Scroll("10s")
                .Query(q =>
                    q.Term(t => t.Field($"{PROPERTIES}.{FeatureAttributes.POI_SOURCE}").Value(source.ToLower()))
                )
        );
        var features = GetAllItemsByScrolling(response);
        logger.LogInformation($"Got {features.Count} features for source {source}");
        return features.Select(f => f.Source).ToList();
    }

    public async Task<IFeature> GetExternalPoiById(string id, string source)
    {
        var response = await _elasticClient.GetAsync<IFeature>(GeoJsonExtensions.GetId(source, id), r => r.Index(EXTERNAL_POIS));
        return response.Source;
    }

    public async Task AddExternalPois(List<IFeature> features)
    {
        if ((await _elasticClient.Indices.ExistsAsync(EXTERNAL_POIS)).Exists == false)
        {
            await CreateExternalPoisIndex();
        }
        await UpdateData(features, EXTERNAL_POIS);
    }

    public Task DeleteExternalPoisBySource(string source)
    {
        return _elasticClient.DeleteByQueryAsync<IFeature>(d =>
            d.Index(EXTERNAL_POIS)
                .Query(q =>
                    q.Term(t => t.Field($"{PROPERTIES}.{FeatureAttributes.POI_SOURCE}").Value(source.ToLower()))
                )
        );
    }

    private Task CreateExternalPoisIndex()
    {
        return _elasticClient.Indices.CreateAsync(EXTERNAL_POIS,
            c => c.Map<IFeature>(m =>
                m.Properties(fp =>
                    fp.Object<IAttributesTable>(a => a
                        .Name(PROPERTIES)
                        .Properties(p => p.Keyword(s => s.Name(FeatureAttributes.ID)))
                    )
                )
            ).Settings(s => s.Setting("index.mapping.total_fields.limit", 10000))
        );
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

    public async Task<ImageItem> GetImageByUrl(string url)
    {
        var response = await _elasticClient.SearchAsync<ImageItem>(s =>
            s.Index(IMAGES)
                .Query(q => q.Match(m => m.Field(i => i.ImageUrls).Query(url)))
        );
        return response.Documents.FirstOrDefault();
    }

    public async Task<ImageItem> GetImageByHash(string hash)
    {
        var response = await _elasticClient.GetAsync<ImageItem>(hash, r => r.Index(IMAGES));
        return response.Source;
    }
    public async Task<List<string>> GetAllUrls()
    {
        await _elasticClient.Indices.RefreshAsync(IMAGES);
        var response = await _elasticClient.SearchAsync<ImageItem>(
            s => s.Index(IMAGES)
                .Size(10000)
                .Scroll("10s")
                .Source(sf => sf
                    .Includes(i => i.Fields(f => f.ImageUrls, f => f.Hash))
                ).Query(q => q.MatchAll())
        );
        var list = GetAllItemsByScrolling(response);
        return list.SelectMany(i => i.Source.ImageUrls ?? []).ToList();
    }

    public Task StoreImage(ImageItem imageItem)
    {
        return _elasticClient.IndexAsync(imageItem, r => r.Index(IMAGES).Id(imageItem.Hash));
    }

    public async Task DeleteImageByUrl(string url)
    {
        var imageItem = await GetImageByUrl(url);
        if (imageItem != null)
        {
            await _elasticClient.DeleteAsync<IFeature>(imageItem.Hash, d => d.Index(IMAGES));
        }
    }

    public Task StoreRebuildContext(RebuildContext context)
    {
        return _elasticClient.IndexAsync(context, r => r.Index(REBUILD_LOG).Id(context.StartTime.ToString("o")));
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

    // Mirror of the index-time Hebrew keyword normalizer (doubled-matres fold only) so a query can be
    // compared against a stored name.<l>.keyword value in the painless exact-name floor.
    private const string HebrewVav = "\u05D5";
    private const string HebrewYod = "\u05D9";

    private static string ApplyHebrewMatresDoubledOnly(string input)
    {
        if (string.IsNullOrEmpty(input)) return input;
        return input
            .Replace("\u05D5\u05D5", HebrewVav)
            .Replace("\u05D9\u05D9", HebrewYod);
    }

    /// <summary>Normalize a query to match a stored name.&lt;l&gt;.keyword value; <paramref name="isHebrew"/> adds the doubled-matres fold.</summary>
    internal static string NormalizeForKeyword(string input, bool isHebrew)
    {
        if (string.IsNullOrEmpty(input)) return input;
        if (!isHebrew)
        {
            return NormalizeSearchTerm(input);
        }
        // Strip niqqud, fold matres, then the shared accent-fold + lowercase.
        var niqqudStripped = string.Concat(
            input.Normalize(NormalizationForm.FormD)
                 .Where(c => c < '\u05B0' || c > '\u05C7')
                 .Where(c => CharUnicodeInfo.GetUnicodeCategory(c)
                             != UnicodeCategory.NonSpacingMark)
        ).Normalize(NormalizationForm.FormC);
        return ApplyHebrewMatresDoubledOnly(niqqudStripped).ToLowerInvariant();
    }

    // The name.<l>.keyword subfields the exact-name floor inspects (one per language + default).
    private static readonly List<string> NameKeywordFields =
        Languages.ArrayWithDefault.Select(l => "name." + l + ".keyword").ToList();
}