using IsraelHiking.Common;

namespace IsraelHiking.API.Services
{
    public interface IDouglasPeuckerReductionService
    {
        RouteData SimplifyRouteData(RouteData routeData, string routingType);
    }
}