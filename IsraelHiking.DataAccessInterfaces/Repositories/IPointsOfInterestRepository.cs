using IsraelHiking.Common;
using NetTopologySuite.Features;
using NetTopologySuite.Geometries;
using System;
using System.Collections.Generic;
using System.Threading.Tasks;

namespace IsraelHiking.DataAccessInterfaces.Repositories
{
    public interface IPointsOfInterestRepository
    {
        Task StorePointsOfInterestDataToSecondaryIndex(List<IFeature> pointsOfInterest);
        Task SwitchPointsOfInterestIndices();
        Task<IFeature> GetClosestPoint(Coordinate location);
        Task<List<IFeature>> GetAllPointsOfInterest();
        Task StoreRebuildContext(RebuildContext context);
    }
}
