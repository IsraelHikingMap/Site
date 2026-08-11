using System.Text.Json.Serialization;

namespace IsraelHiking.Common.Api;

/// <summary>
/// Normalized, engine- and platform-agnostic turn-by-turn maneuver kind used by the V2 instructions
/// model (see <see cref="RouteInstruction"/>). Serialized as a kebab-case string on the wire so that
/// clients which receive an unknown (newly added) kind can degrade gracefully rather than fail to
/// parse. Each platform maps these to its own representation (Android <c>Maneuver.TYPE_*</c>, iOS
/// CarPlay <c>CPManeuver</c> symbol images, ...).
/// </summary>
[JsonConverter(typeof(JsonStringEnumConverter<ManeuverType>))]
public enum ManeuverType
{
    [JsonStringEnumMemberName("continue")]
    Continue,
    [JsonStringEnumMemberName("depart")]
    Depart,
    [JsonStringEnumMemberName("arrive")]
    Arrive,
    [JsonStringEnumMemberName("slight-left")]
    SlightLeft,
    [JsonStringEnumMemberName("left")]
    Left,
    [JsonStringEnumMemberName("sharp-left")]
    SharpLeft,
    [JsonStringEnumMemberName("uturn-left")]
    UturnLeft,
    [JsonStringEnumMemberName("slight-right")]
    SlightRight,
    [JsonStringEnumMemberName("right")]
    Right,
    [JsonStringEnumMemberName("sharp-right")]
    SharpRight,
    [JsonStringEnumMemberName("uturn-right")]
    UturnRight,
    [JsonStringEnumMemberName("keep-left")]
    KeepLeft,
    [JsonStringEnumMemberName("keep-right")]
    KeepRight,
    [JsonStringEnumMemberName("ramp-left")]
    RampLeft,
    [JsonStringEnumMemberName("ramp-right")]
    RampRight,
    [JsonStringEnumMemberName("merge")]
    Merge,
    [JsonStringEnumMemberName("roundabout")]
    Roundabout,
    [JsonStringEnumMemberName("roundabout-exit")]
    RoundaboutExit,
    [JsonStringEnumMemberName("ferry-enter")]
    FerryEnter,
    [JsonStringEnumMemberName("ferry-exit")]
    FerryExit
}
