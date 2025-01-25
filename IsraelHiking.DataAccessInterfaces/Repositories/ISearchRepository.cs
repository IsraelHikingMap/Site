using NetTopologySuite.Features;
using NetTopologySuite.Geometries;
using System.Collections.Generic;
using System.Threading.Tasks;

namespace IsraelHiking.DataAccessInterfaces.Repositories
{
    public interface ISearchRepository
    {
        Task<List<IFeature>> Search(string searchTerm, string language);
        Task<List<IFeature>> SearchPoints(string searchTerm, string language);
        Task<List<IFeature>> SearchPlaces(string place, string language);
        Task<List<IFeature>> SearchByLocation(Coordinate northEast, Coordinate southWest, string searchTerm, string language);
        Task<List<IFeature>> SearchExact(string searchTerm, string language);
        Task<List<IFeature>> GetContainers(Coordinate coordinate);
        Task<string> GetContainerName(Coordinate coordinate, string language);
    }
}
