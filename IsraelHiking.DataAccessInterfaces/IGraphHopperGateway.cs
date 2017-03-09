using IsraelHiking.Common;
using System.Threading.Tasks;
using NetTopologySuite.Geometries;

namespace IsraelHiking.DataAccessInterfaces
{
    public interface IGraphHopperGateway
    {
        Task<LineString> GetRouting(RoutingGatewayRequest request);
    }
}
