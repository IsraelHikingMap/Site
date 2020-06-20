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
        Task StorePointsOfInterestDataToSecondaryIndex(List<Feature> pointsOfInterest);
        Task SwitchPointsOfInterestIndices();
        Task UpdatePointsOfInterestData(List<Feature> features);
        Task<List<Feature>> GetPointsOfInterest(Coordinate northEast, Coordinate southWest, string[] categories, string language);
        Task<List<Feature>> GetAllPointsOfInterest(bool withDeleted);
        Task<List<Feature>> GetPointsOfInterestUpdates(DateTime lastModifiedDate);
        Task<Feature> GetPointOfInterestById(string id, string source);
        Task DeleteOsmPointOfInterestById(string id, DateTime? timeStamp);
        Task DeletePointOfInterestById(string id, string source);
        Task StoreRebuildContext(RebuildContext context);
        Task<DateTime> GetLastSuccessfulRebuildTime();
    }
}
