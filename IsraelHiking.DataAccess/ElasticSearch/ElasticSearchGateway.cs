using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using IsraelHiking.DataAccessInterfaces;
using Nest;
using NetTopologySuite.IO;
using Newtonsoft.Json;
using Feature = NetTopologySuite.Features.Feature;

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

        public void Initialize(string uri = "http://localhost:9200/", bool deleteIndex = false)
        {
            _logger.Info("Initialing elastic search with uri: " + uri);
            var connectionString = new ConnectionSettings(new Uri(uri))
                .DefaultIndex(OSM_INDEX)
                .PrettyJson();
            _elasticClient = new ElasticClient(connectionString);
            
            if (deleteIndex && _elasticClient.IndexExists(OSM_INDEX).Exists)
            {
                _elasticClient.DeleteIndex(OSM_INDEX);
            }
            //_elasticClient.CreateIndex(OSM_INDEX,
            //    c => c.Mappings(
            //        ms => ms.Map<Feature>(m =>
            //            m.Properties(ps => ps.GeoShape(g => g.Name(f => f.Geometry)
            //                .Tree(GeoTree.Geohash)
            //                .TreeLevels(10)
            //                .DistanceErrorPercentage(0.2))))));
            _logger.Info("Finished initialing elastic search with uri: " + uri);
        }

        public async Task UpdateData(List<Feature> features)
        {
            var writer = new NetTopologySuite.IO.GeoJsonWriter();
            var result = await _elasticClient.BulkAsync(bulk =>
            {
                foreach (var feature in features)
                {
                    bulk.Index<object>(i => i.Document(JsonConvert.DeserializeObject(writer.Write(feature))).Id(GetId(feature)));
                }
                return bulk;
            });
            if (result.IsValid == false)
            {
                result.ItemsWithErrors.ToList().ForEach(i => _logger.Error("Inserting " + i.Id + " falied with error: " + i.Error.Reason + " caused by: " + i.Error.CausedBy.Reason));
            }
        }

        public async Task<List<Feature>> Search(string searchTerm, string fieldName)
        {
            if (string.IsNullOrWhiteSpace(searchTerm))
            {
                return new List<Feature>();
            }
            var field = "properties." + fieldName;
            var response = await _elasticClient.SearchAsync<object>(
                s => s.Size(NUMBER_OF_RESULTS)
                    .TrackScores()
                    .Sort(f => f.Descending("_score"))
                    .Query(
                        q => q.FunctionScore(
                            fs => fs.Query(
                                iq => iq.DisMax(
                                    dm => dm.Queries(
                                        dmq => dmq.MultiMatch(
                                            mm => mm.Query(searchTerm)
                                                .Fields(f => f.Fields(field, "properties.name*", "properties._name"))
                                                .Type(TextQueryType.BestFields)
                                                .Fuzziness(Fuzziness.Auto)
                                        ),
                                        dmq => dmq.Match(
                                            m => m.Query(searchTerm)
                                                .Boost(1.2)
                                                .Field(new Field {Name = field})
                                        )
                                    )
                                )
                            ).Functions(fn => fn.FieldValueFactor(f => f.Field("properties.search_factor")))
                        )
                    )
            );
            var reader = new GeoJsonReader();
            return response.Documents.Select(d => reader.Read<Feature>(d.ToString())).ToList();
        }

        public async Task<Feature> GetContainingFeature(Feature feature)
        {
            var featureId = GetId(feature);
            var response = await _elasticClient.SearchAsync<Feature>(
                s => s.Query(
                    q => q.Bool(
                        b => b.Must(
                            f1 => f1.GeoIndexedShape(
                                g => g.Field(f => f.Geometry)
                                    .Relation(GeoShapeRelation.Contains)
                                    .IndexedShape(
                                        indexShape => indexShape.Id(featureId)
                                            .Path(f => f.Geometry)
                                    )
                            )
                        ).MustNot(
                            mn => mn.Ids(i => i.Values(featureId))
                        )
                    )
                )
            );
            return response.Documents.FirstOrDefault();
        }

        private string GetId(Feature feature)
        {
            return feature.Geometry.GeometryType + "_" + feature.Attributes["osm_id"];
        }
    }
}
