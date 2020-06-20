using NetTopologySuite.Features;
using NetTopologySuite.Geometries;
using System.Collections.Generic;
using System.Threading.Tasks;

namespace IsraelHiking.DataAccessInterfaces.Repositories
{
    public interface IHighwaysRepository
    {
        Task UpdateHighwaysZeroDownTime(List<Feature> highways);
        Task UpdateHighwaysData(List<Feature> features);
        Task<List<Feature>> GetHighways(Coordinate northEast, Coordinate southWest);
        Task DeleteHighwaysById(string id);
    }
}
