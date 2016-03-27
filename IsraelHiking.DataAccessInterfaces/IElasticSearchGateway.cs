using System.Collections.Generic;
using System.Threading.Tasks;
using GeoJSON.Net.Feature;

namespace IsraelHiking.DataAccess.ElasticSearch
{
    public interface IElasticSearchGateway
    {
        Task DeleteAll();
        void Initialize(string uri = "http://localhost:9200/");
        Task<List<Feature>> Search(string searchTerm, string languageCode = null);
        Task UpdateData(List<Feature> features);
    }
}