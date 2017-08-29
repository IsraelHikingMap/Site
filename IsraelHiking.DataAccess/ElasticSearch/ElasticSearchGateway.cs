using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using GeoAPI.Geometries;
using IsraelHiking.DataAccessInterfaces;
using Nest;
using Feature = NetTopologySuite.Features.Feature;
using Microsoft.Extensions.Logging;
using NetTopologySuite.IO.Converters;
using Newtonsoft.Json;
using Elasticsearch.Net;
using IsraelHiking.Common;
using NetTopologySuite.Features;
using OsmSharp;

namespace IsraelHiking.DataAccess.ElasticSearch
{
    public class GeoJsonNetSerializer : JsonNetSerializer
    {
        public GeoJsonNetSerializer(IConnectionSettingsValues settings) : base(settings)
        {
            OverwriteDefaultSerializers((s, cvs) =>
            {
                s.Converters.Add(new CoordinateConverter());
                s.Converters.Add(new GeometryConverter());
                s.Converters.Add(new FeatureCollectionConverter());
                s.Converters.Add(new FeatureConverter());
                s.Converters.Add(new AttributesTableConverter());
                s.Converters.Add(new ICRSObjectConverter());
                s.Converters.Add(new GeometryArrayConverter());
                s.Converters.Add(new EnvelopeConverter());
            });
        }

        public GeoJsonNetSerializer(IConnectionSettingsValues settings, JsonConverter statefulConverter) : base(settings, statefulConverter)
        {
            OverwriteDefaultSerializers((s, cvs) =>
            {
                s.Converters.Add(new CoordinateConverter());
                s.Converters.Add(new GeometryConverter());
                s.Converters.Add(new FeatureCollectionConverter());
                s.Converters.Add(new FeatureConverter());
                s.Converters.Add(new AttributesTableConverter());
                s.Converters.Add(new ICRSObjectConverter());
                s.Converters.Add(new GeometryArrayConverter());
                s.Converters.Add(new EnvelopeConverter());
            });
        }
    }

    public class ElasticSearchGateway : IElasticSearchGateway
    {
        private const int PAGE_SIZE = 10000;

        private const string PROPERTIES = "properties";
        private const string OSM_NAMES_INDEX1 = "osm_names1";
        private const string OSM_NAMES_INDEX2 = "osm_names2";
        private const string OSM_HIGHWAYS_INDEX1 = "osm_highways1";
        private const string OSM_HIGHWAYS_INDEX2 = "osm_highways2";
        private const string OSM_NAMES_ALIAS = "osm_names";
        private const string OSM_HIGHWAYS_ALIAS = "osm_highways";
        private const string RATINGS = "ratings";

        private const int NUMBER_OF_RESULTS = 10;
        private readonly ILogger _logger;
        private IElasticClient _elasticClient;

        public ElasticSearchGateway(ILogger logger)
        {
            _logger = logger;
        }

        public void Initialize(string uri = "http://localhost:9200/")
        {
            _logger.LogInformation("Initialing elastic search with uri: " + uri);
            var pool = new SingleNodeConnectionPool(new Uri(uri));
            var connectionString = new ConnectionSettings(
                pool,
                new HttpConnection(),
                new SerializerFactory(s => new GeoJsonNetSerializer(s)))
                .PrettyJson();
            _elasticClient = new ElasticClient(connectionString);
            if (_elasticClient.IndexExists(OSM_NAMES_INDEX1).Exists == false && 
                _elasticClient.IndexExists(OSM_NAMES_INDEX2).Exists == false)
            {
                CreateNamesIndex(OSM_NAMES_INDEX1);
                _elasticClient.Alias(a => a.Add(add => add.Alias(OSM_NAMES_ALIAS).Index(OSM_NAMES_INDEX1)));
            }
            if (_elasticClient.IndexExists(OSM_NAMES_INDEX1).Exists &&
                _elasticClient.IndexExists(OSM_NAMES_INDEX2).Exists)
            {
                _elasticClient.DeleteIndex(OSM_NAMES_INDEX2);
            }
            if (_elasticClient.IndexExists(OSM_HIGHWAYS_INDEX1).Exists == false &&
                _elasticClient.IndexExists(OSM_HIGHWAYS_INDEX2).Exists == false)
            {
                CreateHighwaysIndex(OSM_HIGHWAYS_INDEX1);
                _elasticClient.Alias(a => a.Add(add => add.Alias(OSM_HIGHWAYS_ALIAS).Index(OSM_HIGHWAYS_INDEX1)));
            }
            if (_elasticClient.IndexExists(OSM_HIGHWAYS_INDEX1).Exists &&
                _elasticClient.IndexExists(OSM_HIGHWAYS_INDEX2).Exists)
            {
                _elasticClient.DeleteIndex(OSM_HIGHWAYS_INDEX2);
            }
            if (_elasticClient.IndexExists(RATINGS).Exists == false)
            {
                _elasticClient.CreateIndex(RATINGS);
            }
            _logger.LogInformation("Finished initialing elastic search with uri: " + uri);
        }

        public async Task UpdateDataZeroDownTime(List<Feature> names, List<Feature> highways)
        {
            // init
            var currentNameIndex = OSM_NAMES_INDEX1;
            var currentHighwayIndex = OSM_HIGHWAYS_INDEX1;
            var newNameIndex = OSM_NAMES_INDEX2;
            var newHighwayIndex = OSM_HIGHWAYS_INDEX2;
            if (_elasticClient.IndexExists(OSM_NAMES_INDEX2).Exists)
            {
                currentNameIndex = OSM_NAMES_INDEX2;
                currentHighwayIndex = OSM_HIGHWAYS_INDEX2;
                newNameIndex = OSM_NAMES_INDEX1;
                newHighwayIndex = OSM_HIGHWAYS_INDEX1;
            }
            // create new indexes
            await CreateNamesIndex(newNameIndex);
            await CreateHighwaysIndex(newHighwayIndex);
            // update data
            await UpdateUsingPaging(names, newNameIndex);
            await UpdateUsingPaging(highways, newHighwayIndex);
            // change alias
            await _elasticClient.AliasAsync(a => a
                .Remove(i => i.Alias(OSM_NAMES_ALIAS).Index(currentNameIndex))
                .Remove(i => i.Alias(OSM_HIGHWAYS_ALIAS).Index(currentHighwayIndex))
                .Add(i => i.Alias(OSM_NAMES_ALIAS).Index(newNameIndex))
                .Add(i => i.Alias(OSM_HIGHWAYS_ALIAS).Index(newHighwayIndex))
                );
            // delete old indexes
            await _elasticClient.DeleteIndexAsync(currentNameIndex);
            await _elasticClient.DeleteIndexAsync(currentHighwayIndex);
        }

        public Task UpdateHighwaysData(List<Feature> features)
        {
            return UpdateData(features, OSM_HIGHWAYS_ALIAS);
        }

        public Task UpdateNamesData(Feature feature)
        {
            return UpdateData(new List<Feature> {feature}, OSM_NAMES_ALIAS);
        }

        public Task UpdateRating(Rating rating)
        {
            return _elasticClient.IndexAsync(rating, r => r.Index(RATINGS).Id(GetId(rating)));
        }

        private async Task UpdateData(List<Feature> features, string alias)
        {
            var result = await _elasticClient.BulkAsync(bulk =>
            {
                foreach (var feature in features)
                {
                    bulk.Index<Feature>(i => i.Index(alias).Document(feature).Id(GetId(feature)));
                }
                return bulk;
            });
            if (result.IsValid == false)
            {
                result.ItemsWithErrors.ToList().ForEach(i => _logger.LogError($"Inserting {i.Id} falied with error: {i.Error?.Reason ?? string.Empty} caused by: {i.Error?.CausedBy?.Reason ?? string.Empty}"));
            }
        }

        public async Task<List<Feature>> Search(string searchTerm, string fieldName)
        {
            if (string.IsNullOrWhiteSpace(searchTerm))
            {
                return new List<Feature>();
            }
            var field = $"{PROPERTIES}.{fieldName}";
            var response = await _elasticClient.SearchAsync<Feature>(
                s => s.Index(OSM_NAMES_ALIAS)
                    .Size(NUMBER_OF_RESULTS)
                    .TrackScores()
                    .Sort(f => f.Descending("_score"))
                    .Query(
                        q => q.FunctionScore(
                            fs => fs.Query(
                                iq => iq.DisMax(
                                    dm => dm.Queries(
                                        dmq => dmq.MultiMatch(
                                            mm => mm.Query(searchTerm)
                                                .Fields(f => f.Fields(field, $"{PROPERTIES}.name*", $"{PROPERTIES}._name"))
                                                .Type(TextQueryType.BestFields)
                                                .Fuzziness(Fuzziness.Auto)
                                        ),
                                        dmq => dmq.Match(
                                            m => m.Query(searchTerm)
                                                .Boost(1.2)
                                                .Field(field)
                                        )
                                    )
                                )
                            ).Functions(fn => fn.FieldValueFactor(f => f.Field($"{PROPERTIES}.{FeatureAttributes.SEARCH_FACTOR}")))
                        )
                    )
            );
            return response.Documents.ToList();
        }

        public async Task<List<Feature>> GetHighways(Coordinate northEast, Coordinate southWest)
        {
            var response = await _elasticClient.SearchAsync<Feature>(
                s => s.Index(OSM_HIGHWAYS_ALIAS)
                    .Size(5000).Query(
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

        public async Task<List<Feature>> GetPointsOfInterest(Coordinate northEast, Coordinate southWest, string[] categories)
        {
            var response = await _elasticClient.SearchAsync<Feature>(
                s => s.Index(OSM_NAMES_ALIAS)
                    .Size(10000).Query(
                        q => q.GeoBoundingBox(
                            b => b.BoundingBox(bb => 
                                bb.TopLeft(new GeoCoordinate(northEast.Y, southWest.X))
                                .BottomRight(new GeoCoordinate(southWest.Y, northEast.X))
                                ).Field($"{PROPERTIES}.{FeatureAttributes.GEOLOCATION}")
                        ) && q.Terms(t => t.Field($"{PROPERTIES}.{FeatureAttributes.POI_CATEGORY}").Terms(categories.Select(c => c.ToLower()).ToArray()))
                    )
            );
            return response.Documents.ToList();
        }

        public async Task<Feature> GetPointOfInterestById(string id, string source)
        {
            var response = await _elasticClient.SearchAsync<Feature>(
                s => s.Index(OSM_NAMES_ALIAS)
                    .Size(1).Query(
                        q => q.Term(t => t.Field($"{PROPERTIES}.{FeatureAttributes.POI_SOURCE}").Value(source.ToLower()))
                             && q.Term(t => t.Field($"{PROPERTIES}.{FeatureAttributes.ID}").Value(id))
                    )
            );
            return response.Documents.FirstOrDefault();
        }

        public Task<Rating> GetRating(string id, string source)
        {
            return Task.Run(() =>
            {
                var response = _elasticClient.Get<Rating>(GetId(source, id), r => r.Index(RATINGS));
                return response.Source ?? new Rating
                {
                    Id = id,
                    Source = source,
                    Raters = new List<Rater>()
                };
            });

        }

        private Task CreateHighwaysIndex(string highwaysIndexName)
        {
            return _elasticClient.CreateIndexAsync(highwaysIndexName,
                c => c.Mappings(
                    ms => ms.Map<Feature>(m =>
                        m.Properties(ps => ps.GeoShape(g => g.Name(f => f.Geometry)
                            .Tree(GeoTree.Geohash)
                            .TreeLevels(10)
                            .DistanceErrorPercentage(0.2)))
                    )
                )
            );
        }

        private Task CreateNamesIndex(string namesIndexName)
        {
            return _elasticClient.CreateIndexAsync(namesIndexName,
                f => f.Mappings(ms => ms
                    .Map<Feature>(m => m
                        .Properties(ps => ps
                            .Object<AttributesTable>(o => o
                                .Name(PROPERTIES)
                                .Properties(p => p.GeoPoint(s => s.Name(FeatureAttributes.GEOLOCATION)))
                            )
                        )
                    )
                )
            );
        }

        private async Task UpdateUsingPaging(List<Feature> features, string alias)
        {
            _logger.LogInformation($"Starting indexing {features.Count} records");
            var smallCahceList = new List<Feature>(PAGE_SIZE);
            int total = 0;
            foreach (var feature in features)
            {
                smallCahceList.Add(feature);
                if (smallCahceList.Count < PAGE_SIZE)
                {
                    continue;
                }
                total += smallCahceList.Count;
                await UpdateData(smallCahceList, alias);
                _logger.LogInformation($"Indexed {total} records of {features.Count}");
                smallCahceList.Clear();
            }
            await UpdateData(smallCahceList, alias);
            _logger.LogInformation($"Finished indexing {features.Count} records");
        }

        private string GetId(Feature feature)
        {
            return feature.Geometry.GeometryType + "_" + GetId(feature.Attributes[FeatureAttributes.POI_SOURCE]?.ToString() ?? string.Empty, feature.Attributes[FeatureAttributes.ID]?.ToString() ?? string.Empty);
        }

        private string GetId(Rating rating)
        {
            return GetId(rating.Source, rating.Id);
        }

        private string GetId(string source, string id)
        {
            return source + "_" + id;
        }
    }
}
