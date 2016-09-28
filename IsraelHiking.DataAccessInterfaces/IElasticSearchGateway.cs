using System.Collections.Generic;
using System.Threading.Tasks;
using NetTopologySuite.Features;

namespace IsraelHiking.DataAccessInterfaces
{
    public interface IElasticSearchGateway
    {
        void Initialize(string uri = "http://localhost:9200/", bool deleteIndex = false);
        Task<List<Feature>> Search(string searchTerm, string fieldName);
        Task UpdateData(List<Feature> features);
        Task<Feature> GetContainingFeature(Feature feature);
    }
}