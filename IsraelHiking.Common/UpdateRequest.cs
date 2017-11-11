using System;
using System.Collections.Generic;
using System.Text;

namespace IsraelHiking.Common
{
    public class UpdateRequest
    {
        public bool Routing { get; set; }
        public bool PointsOfInterest { get; set; }
        public bool Highways { get; set; }
    }
}
