using System.Threading.Tasks;
using NetTopologySuite.Features;
using IsraelHiking.Common.Api;

namespace IsraelHiking.DataAccessInterfaces
{
    public interface IGraphHopperGateway
    {
        Task<Feature> GetRouting(RoutingGatewayRequest request);
    }
}
