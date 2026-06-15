using System.Collections.Generic;
using System.Text.Json.Serialization;

namespace IsraelHiking.Common.Poi;

public class SearchResultsPointOfInterest
{
    [JsonPropertyName("id")]
    public string Id { get; set; }
    [JsonPropertyName("source")]
    public string Source { get; set; }
    [JsonPropertyName("title")]
    public string Title { get; set; }
    [JsonPropertyName("displayName")]
    public string DisplayName { get; set; }
    [JsonPropertyName("icon")]
    public string Icon { get; set; }
    [JsonPropertyName("iconColor")]
    public string IconColor { get; set; }
    [JsonPropertyName("location")]
    public LatLng Location { get; set; }
    [JsonPropertyName("hasExtraData")]
    public bool HasExtraData { get; set; }

    /// <summary>Debug signals, populated only when the DEBUG_SEARCH env flag is set; null and omitted otherwise.</summary>
    [JsonPropertyName("debug")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
    public SearchDebugInfo Debug { get; set; }
}

/// <summary>Diagnostic view of a search hit (DEBUG_SEARCH only); all fields nullable, omitted unless enabled.</summary>
public class SearchDebugInfo
{
    [JsonPropertyName("featureClass")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
    public string FeatureClass { get; set; }

    [JsonPropertyName("prominence")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
    public float? Prominence { get; set; }

    [JsonPropertyName("matchedLanguage")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
    public string MatchedLanguage { get; set; }

    [JsonPropertyName("altNames")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
    public Dictionary<string, List<string>> AltNames { get; set; }

    [JsonPropertyName("container")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
    public string Container { get; set; }

    /// <summary>Final relevance score.</summary>
    [JsonPropertyName("score")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
    public double? Score { get; set; }

    /// <summary>Raw BM25 text score (inner name-query _score), recovered from the explain tree.</summary>
    [JsonPropertyName("bm25")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
    public double? Bm25 { get; set; }

    /// <summary>Per-term contributions to the final score (text/geo/prom/pclass/area/country/vp).</summary>
    [JsonPropertyName("scoreBreakdown")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
    public Dictionary<string, double> ScoreBreakdown { get; set; }

    /// <summary>Raw Elasticsearch explain tree for the inner name query (opaque JSON, diagnosis only).</summary>
    [JsonPropertyName("explain")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
    public object Explain { get; set; }
}