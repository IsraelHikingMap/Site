using NetTopologySuite.Features;
using NetTopologySuite.Geometries;
using System.Collections.Generic;
using System.Threading.Tasks;

namespace IsraelHiking.DataAccessInterfaces.Repositories
{
    public interface ISearchRepository
    {
        Task<List<Feature>> Search(string searchTerm, string language);
        Task<List<Feature>> SearchPlaces(string place, string language);
        Task<List<Feature>> SearchByLocation(Coordinate northEast, Coordinate southWest, string searchTerm, string language);
        Task<List<Feature>> SearchExact(string searchTerm, string language);
        Task<List<Feature>> GetContainers(Coordinate coordinate);
    }
}
