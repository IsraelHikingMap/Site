using System.Collections.Generic;
using System.Threading.Tasks;
using GeoAPI.Geometries;
using NetTopologySuite.Features;

namespace IsraelHiking.DataAccessInterfaces
{
    public interface IElasticSearchGateway : IRepository
    {
        void Initialize(string uri = "http://localhost:9200/");
        Task<List<Feature>> Search(string searchTerm, string fieldName);
        Task<List<Feature>> SearchPlaces(string place, string fieldName);
        Task<List<Feature>> SearchByLocation(Coordinate nortEast, Coordinate southWest, string searchTerm, string fieldName);

        Task UpdateHighwaysZeroDownTime(List<Feature> highways);
        Task UpdateHighwaysData(List<Feature> features);
        Task<List<Feature>> GetHighways(Coordinate northEast, Coordinate southWest);
        Task DeleteHighwaysById(string id);

        Task UpdatePointsOfInterestZeroDownTime(List<Feature> pointsOfInterest);
        Task UpdatePointsOfInterestData(List<Feature> features);
        Task<List<Feature>> GetPointsOfInterest(Coordinate northEast, Coordinate southWest, string[] categories, string language);
        Task<Feature> GetPointOfInterestById(string id, string source, string type);
        Task DeletePointOfInterestById(string id, string type);
    }
}