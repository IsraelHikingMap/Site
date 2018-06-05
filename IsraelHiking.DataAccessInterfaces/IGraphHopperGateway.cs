using IsraelHiking.Common;
using System.Threading.Tasks;
using NetTopologySuite.Geometries;
using System.IO;

namespace IsraelHiking.DataAccessInterfaces
{
    public interface IGraphHopperGateway
    {
        Task<LineString> GetRouting(RoutingGatewayRequest request);
        Task Rebuild(MemoryStream osmFileStream);
    }
}
