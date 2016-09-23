using System.Threading.Tasks;
using System.Web.Http;
using GeoJSON.Net.Feature;
using IsraelHiking.DataAccessInterfaces;

namespace IsraelHiking.API.Controllers
{
    public class SearchController : ApiController
    {
        private readonly IElasticSearchGateway _elasticSearchGateway;

        public SearchController(IElasticSearchGateway elasticSearchGateway)
        {
            _elasticSearchGateway = elasticSearchGateway;
        }

        // GET api/search/searchTerm=abc&language=en
        public async Task<FeatureCollection> GetSearchResults(string id, string language = null)
        {
            var fieldName = string.IsNullOrWhiteSpace(language) ? "name" : "name:" + language;
            var features = await _elasticSearchGateway.Search(id, fieldName);
            foreach (var feature in features)
            {
                var container = await _elasticSearchGateway.GetContainingFeature(feature);
                if (container != null && container.Properties.ContainsKey(fieldName))
                {
                    feature.Properties["address"] = container.Properties[fieldName];
                }
            }
            return new FeatureCollection(features);
        }
    }
}
