using System.Collections.Generic;
using GeoAPI.Geometries;

namespace IsraelHiking.API.Services
{
    public interface IDouglasPeuckerReductionService
    {
        List<int> GetSimplifiedRouteIndexes(IReadOnlyList<Coordinate> points, double tolerance);
    }
}