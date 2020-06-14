using NetTopologySuite.Features;
using System;
using System.Collections.Generic;
using System.Text;
using System.Threading.Tasks;

namespace IsraelHiking.DataAccessInterfaces.Repositories
{
    public interface IExternalSourcesRepository
    {
        Task<List<Feature>> GetExternalPoisBySource(string source);
        Task<Feature> GetExternalPoiById(string id, string source);
        Task AddExternalPois(List<Feature> features);
        Task DeleteExternalPoisBySource(string source);
    }
}
