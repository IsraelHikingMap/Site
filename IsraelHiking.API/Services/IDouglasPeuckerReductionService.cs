using System.Collections.Generic;
using GeoAPI.Geometries;
using IsraelHiking.Common;

namespace IsraelHiking.API.Services
{
    public interface IDouglasPeuckerReductionService
    {
        List<int> GetSimplifiedRouteIndexes(IReadOnlyList<Coordinate> points, double tolerance);
    }
}