using IsraelHiking.Common;

namespace IsraelHiking.API.Services
{
    public interface IRouteDataSplitterService
    {
        RouteData Split(RouteData routeData, string routingType);
    }
}