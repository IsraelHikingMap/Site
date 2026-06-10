using System.Collections.Generic;
using NetTopologySuite.Geometries;

namespace IsraelHiking.Common.Api;

public class MapMatchGatewayRequest
{
    public List<Coordinate> Points { get; set; }
    public ProfileType Profile { get; set; }
    public string Language { get; set; }
}
