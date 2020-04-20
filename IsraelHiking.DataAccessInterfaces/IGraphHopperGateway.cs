using IsraelHiking.Common;
using System.Threading.Tasks;
using System.IO;
using NetTopologySuite.Features;

namespace IsraelHiking.DataAccessInterfaces
{
    public interface IGraphHopperGateway
    {
        Task<Feature> GetRouting(RoutingGatewayRequest request);
    }
}
