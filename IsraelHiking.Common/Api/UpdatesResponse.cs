using NetTopologySuite.Features;
using System;

namespace IsraelHiking.Common.Api;

public class UpdatesResponse
{
    public IFeature[] Features { get; set; }
    public ImageItem[] Images { get; set; }
    public DateTime LastModified { get; set; }
}