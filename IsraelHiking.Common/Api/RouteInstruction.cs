using System.Text.Json.Serialization;

namespace IsraelHiking.Common.Api;

/// <summary>
/// A single normalized turn-by-turn instruction, independent of the underlying routing engine.
/// This is the model returned when a map-match request asks for <see cref="InstructionsFormat.V2"/>.
/// </summary>
public class RouteInstruction
{
    /// <summary>
    /// Normalized maneuver kind, serialized as a kebab-case string (e.g. "depart", "slight-right").
    /// New kinds may be added over time; clients should treat unknown values as "continue".
    /// </summary>
    [JsonPropertyName("type")]
    public ManeuverType Type { get; set; }

    /// <summary>The localized instruction text, ready to be shown to the user.</summary>
    [JsonPropertyName("text")]
    public string Text { get; set; }

    /// <summary>
    /// The localized instruction phrased for text-to-speech / voice guidance (e.g. spelled-out, no
    /// abbreviations). Falls back to <see cref="Text"/> when the engine provides no verbal variant.
    /// </summary>
    [JsonPropertyName("verbalText")]
    public string VerbalText { get; set; }

    /// <summary>The name(s) of the road this maneuver turns onto, or null when unnamed.</summary>
    [JsonPropertyName("streetName")]
    public string StreetName { get; set; }

    /// <summary>The length, in meters, of the segment this maneuver starts.</summary>
    [JsonPropertyName("distanceMeters")]
    public double DistanceMeters { get; set; }

    /// <summary>The estimated time, in seconds, to travel this maneuver's segment.</summary>
    [JsonPropertyName("timeSeconds")]
    public double TimeSeconds { get; set; }

    /// <summary>The exit to take, set only for roundabout maneuvers; null otherwise.</summary>
    [JsonPropertyName("roundaboutExitNumber")]
    public int? RoundaboutExitNumber { get; set; }

    /// <summary>
    /// The [begin, end] indices of this maneuver within the route geometry's coordinate array.
    /// </summary>
    [JsonPropertyName("interval")]
    public int[] Interval { get; set; }
}
