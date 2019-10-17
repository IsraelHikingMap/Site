using NetTopologySuite.Features;
using NetTopologySuite.Geometries;
using System.Collections.Generic;
using System.Threading.Tasks;

namespace IsraelHiking.DataAccessInterfaces
{
    public interface IElasticSearchGateway : IRepository
    {
        void Initialize(string uri = "http://localhost:9200/");
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
        Task<List<Feature>> GetAllPointsOfInterest();
        Task<Feature> GetPointOfInterestById(string id, string source);
        Task DeleteOsmPointOfInterestById(string id);
        Task DeletePointOfInterestById(string id, string source);

        Task<List<FeatureCollection>> GetCachedItems(string source);
        Task<FeatureCollection> GetCachedItemById(string id, string source);
        Task CacheItem(FeatureCollection featureCollection);
    }
}