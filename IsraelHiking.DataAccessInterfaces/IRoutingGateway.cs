using IsraelHiking.Common;
using System.Threading.Tasks;
using NetTopologySuite.Geometries;

namespace IsraelHiking.DataAccessInterfaces
{
    public interface IRoutingGateway
    {
        Task<LineString> GetRouting(RoutingGatewayRequest request);
    }
}
