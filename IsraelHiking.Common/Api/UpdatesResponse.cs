using NetTopologySuite.Features;
using System;
using System.Collections.Generic;
using System.Text;

namespace IsraelHiking.Common.Api
{
    public class UpdatesResponse
    {
        public Feature[] Features { get; set; }
        public ImageItem[] Images { get; set; }
    }
}
