using NetTopologySuite.Features;
using NetTopologySuite.Geometries;
using System.Collections.Generic;
using System.Threading.Tasks;

namespace IsraelHiking.DataAccessInterfaces.Repositories
{
    public interface IHighwaysRepository
    {
        Task UpdateHighwaysZeroDownTime(List<IFeature> highways);
        Task UpdateHighwaysData(List<IFeature> features);
        Task<List<IFeature>> GetHighways(Coordinate northEast, Coordinate southWest);
    }
}
