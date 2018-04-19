using IsraelHiking.Common;

namespace IsraelHiking.API.Services
{
    /// <summary>
    /// Splits a route to segments in order to allow the user to change the route later
    /// </summary>
    public interface IRouteDataSplitterService
    {
        /// <summary>
        /// Splits the route using Douglas-peucker algorithm to keep the important points
        /// </summary>
        /// <param name="routeData">The <see cref="RouteData"/> to split</param>
        /// <returns>A split route</returns>
        RouteData Split(RouteData routeData);
    }
}