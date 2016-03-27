using System;
using System.Collections.Generic;
using System.Linq;
using System.Security.Cryptography;
using System.Text;
using System.Threading.Tasks;
using System.Web.Http;
using GeoJSON.Net.Feature;
using IsraelHiking.DataAccess.ElasticSearch;

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
            return new FeatureCollection(await _elasticSearchGateway.Search(id, language));
        }
    }
}
