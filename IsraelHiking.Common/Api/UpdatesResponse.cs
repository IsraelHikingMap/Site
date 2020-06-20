using NetTopologySuite.Features;

namespace IsraelHiking.Common.Api
{
    public class UpdatesResponse
    {
        public Feature[] Features { get; set; }
        public ImageItem[] Images { get; set; }
    }
}
