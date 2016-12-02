using System.Collections.Generic;
using System.Threading.Tasks;
using IsraelHiking.Common;
using NetTopologySuite.Features;

namespace IsraelHiking.DataAccessInterfaces
{
    public interface IElasticSearchGateway
    {
        void Initialize(string uri = "http://localhost:9200/", bool deleteIndex = false);
        Task<List<Feature>> Search(string searchTerm, string fieldName);
        Task UpdateNamesData(List<Feature> features);
        Task UpdateHighwaysData(List<Feature> features);
        Task<Feature> GetContainingFeature(Feature feature);
        Task<List<Feature>> GetHighways(LatLng northEast, LatLng southWest);
    }
}