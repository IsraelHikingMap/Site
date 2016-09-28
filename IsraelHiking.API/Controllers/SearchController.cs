using System.Collections.ObjectModel;
using System.Linq;
using System.Threading.Tasks;
using System.Web.Http;
using System.Web.Http.Description;
using IsraelHiking.DataAccessInterfaces;
using NetTopologySuite.Features;

namespace IsraelHiking.API.Controllers
{
    public class SearchController : ApiController
    {
        private readonly IElasticSearchGateway _elasticSearchGateway;

        public SearchController(IElasticSearchGateway elasticSearchGateway)
        {
            _elasticSearchGateway = elasticSearchGateway;
        }

        [ResponseType(typeof(FeatureCollection))]
        [HttpGet]
        // GET api/search/searchTerm=abc&language=en
        public async Task<FeatureCollection> GetSearchResults(string id, string language = null)
        {
            var fieldName = string.IsNullOrWhiteSpace(language) ? "name" : "name:" + language;
            var features = await _elasticSearchGateway.Search(id, fieldName);
            return new FeatureCollection(new Collection<IFeature>(features.OfType<IFeature>().ToList()));
        }
    }
}
