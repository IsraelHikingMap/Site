using System.Threading.Tasks;
using NetTopologySuite.Features;
using IsraelHiking.Common.Api;

namespace IsraelHiking.DataAccessInterfaces;

public interface IRoutingGateway
{
    Task<Feature> GetRouting(RoutingGatewayRequest request);
    Task<Feature> GetMapMatch(MapMatchGatewayRequest request);
}