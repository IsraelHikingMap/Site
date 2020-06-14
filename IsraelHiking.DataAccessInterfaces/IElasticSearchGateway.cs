using IsraelHiking.DataAccessInterfaces.Repositories;
using NetTopologySuite.Features;
using NetTopologySuite.Geometries;
using System;
using System.Collections.Generic;
using System.Threading.Tasks;

namespace IsraelHiking.DataAccessInterfaces
{
    public interface IElasticSearchGateway : IRepository, IImagesRepository, IExternalSourcesRepository
    {
        void Initialize();
        Task<List<Feature>> Search(string searchTerm, string language);
        Task<List<Feature>> SearchPlaces(string place, string language);
        Task<List<Feature>> SearchByLocation(Coordinate nortEast, Coordinate southWest, string searchTerm, string language);
        Task<List<Feature>> GetContainers(Coordinate coordinate);

        Task UpdateHighwaysZeroDownTime(List<Feature> highways);
        Task UpdateHighwaysData(List<Feature> features);
        Task<List<Feature>> GetHighways(Coordinate northEast, Coordinate southWest);
        Task DeleteHighwaysById(string id);

        Task UpdatePointsOfInterestZeroDownTime(List<Feature> pointsOfInterest);
        Task UpdatePointsOfInterestData(List<Feature> features);
        Task<List<Feature>> GetPointsOfInterest(Coordinate northEast, Coordinate southWest, string[] categories, string language);
        Task<List<Feature>> GetAllPointsOfInterest(bool withDeleted);
        Task<List<Feature>> GetPointsOfInterestUpdates(DateTime lastModifiedDate);
        Task<Feature> GetPointOfInterestById(string id, string source);
        Task DeleteOsmPointOfInterestById(string id, DateTime? timeStamp);
        Task DeletePointOfInterestById(string id, string source);
    }
}