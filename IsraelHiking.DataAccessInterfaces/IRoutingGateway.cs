using GeoJSON.Net.Geometry;
using IsraelHiking.Common;
using System.Threading.Tasks;

namespace IsraelHiking.DataAccessInterfaces
{
    public interface IRoutingGateway
    {
        Task<LineString> GetRouting(RoutingGatewayRequest request);
    }
}
