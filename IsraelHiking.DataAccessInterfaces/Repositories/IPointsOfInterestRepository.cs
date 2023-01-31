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
        Task UpdatePointsOfInterestData(List<IFeature> features);
        Task<List<IFeature>> GetPointsOfInterest(Coordinate northEast, Coordinate southWest, string[] categories, string language);
        Task<List<IFeature>> GetAllPointsOfInterest(bool withDeleted);
        Task<List<IFeature>> GetPointsOfInterestUpdates(DateTime lastModifiedDate, DateTime modifiedUntil);
        Task<IFeature> GetPointOfInterestById(string id, string source);
        Task DeletePointOfInterestById(string id, string source);
        Task StoreRebuildContext(RebuildContext context);
        Task<DateTime> GetLastSuccessfulRebuildTime();
    }
}
