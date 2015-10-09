using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace IsraelHiking.DataAccess
{
    public enum ProfileType
    {
        Foot,
        Bike,
        Car,
    }

    public class RoutingGatewayRequest
    {
        public string From { get; set; }
        public string To { get; set;}
        public ProfileType Profile { get; set; }
    }
}
