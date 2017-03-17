using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using GeoAPI.Geometries;
using IsraelHiking.DataAccessInterfaces;
using Nest;
using Feature = NetTopologySuite.Features.Feature;
using Microsoft.Extensions.Logging;

namespace IsraelHiking.DataAccess.ElasticSearch
{
    public class ElasticSearchGateway : IElasticSearchGateway
    {
        private const string OSM_NAMES_INDEX = "osm_names";
        private const string OSM_HIGHWAYS_INDEX = "osm_highways";
        private const int NUMBER_OF_RESULTS = 10;
        private readonly ILogger _logger;
        private IElasticClient _elasticClient;

        public ElasticSearchGateway(ILogger logger)
        {
            _logger = logger;
        }

        public void Initialize(string uri = "http://localhost:9200/", bool deleteIndex = false)
        {
            _logger.LogInformation("Initialing elastic search with uri: " + uri);
            var connectionString = new ConnectionSettings(
                new Uri(uri))
                .DefaultIndex(OSM_NAMES_INDEX)
                .PrettyJson();
            _elasticClient = new ElasticClient(connectionString);
            if (deleteIndex && _elasticClient.IndexExists(OSM_NAMES_INDEX).Exists)
            {
                _elasticClient.DeleteIndex(OSM_NAMES_INDEX);
            }
            if (deleteIndex && _elasticClient.IndexExists(OSM_HIGHWAYS_INDEX).Exists)
            {
                _elasticClient.DeleteIndex(OSM_HIGHWAYS_INDEX);
            }
            _elasticClient.CreateIndex(OSM_HIGHWAYS_INDEX,
                    c => c.Mappings(
                        ms => ms.Map<Feature>(m =>
                            m.Properties(ps => ps.GeoShape(g => g.Name(f => f.Geometry)
                                .Tree(GeoTree.Geohash)
                                .TreeLevels(10)
                                .DistanceErrorPercentage(0.2))))));
            _logger.LogInformation("Finished initialing elastic search with uri: " + uri);
        }

        public Task UpdateNamesData(List<Feature> features)
        {
            return UpdateData(features, OSM_NAMES_INDEX);
        }

        public Task UpdateHighwaysData(List<Feature> features)
        {
            return UpdateData(features, OSM_HIGHWAYS_INDEX);
        }

        public async Task UpdateData(List<Feature> features, string index)
        {
            var result = await _elasticClient.BulkAsync(bulk =>
            {
                foreach (var feature in features)
                {
                    bulk.Index<Feature>(i => i.Index(index).Document(feature).Id(GetId(feature)));
                }
                return bulk;
            });
            if (result.IsValid == false)
            {
                result.ItemsWithErrors.ToList().ForEach(i => _logger.LogError("Inserting " + i.Id + " falied with error: " + i.Error.Reason + " caused by: " + i.Error.CausedBy.Reason));
            }
        }

        public async Task<List<Feature>> Search(string searchTerm, string fieldName)
        {
            if (string.IsNullOrWhiteSpace(searchTerm))
            {
                return new List<Feature>();
            }
            var field = "properties." + fieldName;
            var response = await _elasticClient.SearchAsync<Feature>(
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
                                                .Field(new Field(field))
                                        )
                                    )
                                )
                            ).Functions(fn => fn.FieldValueFactor(f => f.Field("properties.search_factor")))
                        )
                    )
            );
            return response.Documents.ToList();
        }

        private string GetId(Feature feature)
        {
            return feature.Geometry.GeometryType + "_" + feature.Attributes["osm_id"];
        }

        public async Task<List<Feature>> GetHighways(Coordinate northEast, Coordinate southWest)
        {
            var response = await _elasticClient.SearchAsync<Feature>(
                s => s.Index(OSM_HIGHWAYS_INDEX).Size(5000).Query(
                    q => q.GeoShapeEnvelope(
                        e => e.Coordinates(new List<GeoCoordinate>
                            {
                                new GeoCoordinate(southWest.Y, northEast.X),
                                new GeoCoordinate(northEast.Y, southWest.X)
                            }).Field("geometry")
                            .Relation(GeoShapeRelation.Intersects)
                    )
                )
            );
            return response.Documents.ToList();
        }
    }
}
