using NetTopologySuite.Features;
using System.Collections.Generic;
using System.Threading.Tasks;

namespace IsraelHiking.DataAccessInterfaces.Repositories
{
    public interface IExternalSourcesRepository
    {
        Task<List<IFeature>> GetExternalPoisBySource(string source);
        Task<IFeature> GetExternalPoiById(string id, string source);
        Task AddExternalPois(List<IFeature> features);
        Task DeleteExternalPoisBySource(string source);
    }
}
