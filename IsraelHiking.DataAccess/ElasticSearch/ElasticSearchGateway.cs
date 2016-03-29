using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using IsraelHiking.DataAccessInterfaces;
using Nest;
using Feature = GeoJSON.Net.Feature.Feature;

namespace IsraelHiking.DataAccess.ElasticSearch
{
    public class ElasticSearchGateway : IElasticSearchGateway
    {
        private const string OSM_INDEX = "osm";
        private const int NUMBER_OF_RESULTS = 10;
        private readonly ILogger _logger;
        private IElasticClient _elasticClient;

        public ElasticSearchGateway(ILogger logger)
        {
            _logger = logger;
        }

        public void Initialize(string uri = "http://localhost:9200/")
        {
            _logger.Info("Initialing elastic search with uri: " + uri);
            var connectionString = new ConnectionSettings(new Uri(uri));
            connectionString.DefaultIndex(OSM_INDEX);
            _elasticClient = new ElasticClient(connectionString);
        }

        public async Task UpdateData(List<Feature> features)
        {
            var result = await _elasticClient.BulkAsync(b =>
            {
                foreach (var feature in features)
                {
                    b.Index<Feature>(i => i.Document(feature)
                        .Id(feature.Geometry.Type.ToString() + "_" + feature.Properties["osm_id"].ToString()));
                }
                return b;
            });
            if (result.IsValid == false)
            {
                result.ItemsWithErrors.ToList().ForEach(i => _logger.Error("Inserting " + i.Id + " falied with error: " + i.Error.Reason));
            }
        }

        public async Task<List<Feature>> Search(string searchTerm, string languageCode = null)
        {
            if (string.IsNullOrWhiteSpace(searchTerm))
            {
                return new List<Feature>();
            }
            var field = string.IsNullOrWhiteSpace(languageCode) ? "properties.name" : "properties.name:" + languageCode;
            var response = await _elasticClient.SearchAsync<Feature>(s => 
                s.Size(NUMBER_OF_RESULTS)
                .TrackScores()
                .Sort(f => f.Descending("properties.sort_order").Descending("_score"))
                .Query(q => q.MultiMatch(mm => mm.Query(searchTerm)
                    .Fields(f => f.Fields(field))
                    .Type(TextQueryType.BestFields))));
            return response.Documents.ToList();
        }

        public Task DeleteAll()
        {
            return _elasticClient.DeleteIndexAsync(OSM_INDEX);
        }
    }
}
