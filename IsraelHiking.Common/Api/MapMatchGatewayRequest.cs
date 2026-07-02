using System.Collections.Generic;
using NetTopologySuite.Geometries;

namespace IsraelHiking.Common.Api;

/// <summary>
/// The shape of the turn-by-turn instructions attached to a map-match result.
/// </summary>
public enum InstructionsFormat
{
    /// <summary>
    /// GraphHopper-compatible instructions (sign/text/distance/exit_number/turn_angle).
    /// This is the default so already-shipped clients keep working when the routing engine changes.
    /// </summary>
    Legacy,
    /// <summary>
    /// Mapeak's normalized turn-by-turn model (see <see cref="RouteInstruction"/>), engine-agnostic
    /// and meant for new clients.
    /// </summary>
    V2
}

public class MapMatchGatewayRequest
{
    public List<Coordinate> Points { get; set; }
    public ProfileType Profile { get; set; }
    public string Language { get; set; }
    public InstructionsFormat Format { get; set; }
}
