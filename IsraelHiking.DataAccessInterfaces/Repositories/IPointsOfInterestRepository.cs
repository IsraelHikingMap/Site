using IsraelHiking.Common;
using NetTopologySuite.Features;
using NetTopologySuite.Geometries;
using System.Collections.Generic;
using System.Threading.Tasks;

namespace IsraelHiking.DataAccessInterfaces.Repositories;

public interface IPointsOfInterestRepository
{
    Task<IFeature> GetClosestPoint(Coordinate location, string source, string language);
    Task<List<IFeature>> GetAllPointsOfInterest();
    Task StoreRebuildContext(RebuildContext context);
}