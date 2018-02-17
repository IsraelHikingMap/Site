using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using Elasticsearch.Net;
using GeoAPI.Geometries;
using IsraelHiking.Common;
using IsraelHiking.DataAccessInterfaces;
using Microsoft.Extensions.Logging;
using Nest;
using NetTopologySuite.Features;
using NetTopologySuite.IO.Converters;
using Newtonsoft.Json;
using Feature = NetTopologySuite.Features.Feature;

namespace IsraelHiking.DataAccess
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
        private const string OSM_POIS_INDEX1 = "osm_names1";
        private const string OSM_POIS_INDEX2 = "osm_names2";
        private const string OSM_POIS_ALIAS = "osm_names";
        private const string OSM_HIGHWAYS_INDEX1 = "osm_highways1";
        private const string OSM_HIGHWAYS_INDEX2 = "osm_highways2";
        private const string OSM_HIGHWAYS_ALIAS = "osm_highways";
        private const string RATINGS = "ratings";
        private const string SHARES = "shares";
        private const string USER_LAYERS = "user_layers";

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
            if (_elasticClient.IndexExists(OSM_POIS_INDEX1).Exists == false &&
                _elasticClient.IndexExists(OSM_POIS_INDEX2).Exists == false)
            {
                CreatePointsOfInterestIndex(OSM_POIS_INDEX1);
                _elasticClient.Alias(a => a.Add(add => add.Alias(OSM_POIS_ALIAS).Index(OSM_POIS_INDEX1)));
            }
            if (_elasticClient.IndexExists(OSM_POIS_INDEX1).Exists &&
                _elasticClient.IndexExists(OSM_POIS_INDEX2).Exists)
            {
                _elasticClient.DeleteIndex(OSM_POIS_INDEX2);
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
            if (_elasticClient.IndexExists(SHARES).Exists == false)
            {
                _elasticClient.CreateIndex(SHARES);
            }
            if (_elasticClient.IndexExists(USER_LAYERS).Exists == false)
            {
                _elasticClient.CreateIndex(SHARES);
            }
            _logger.LogInformation("Finished initialing elasticsearch with uri: " + uri);
        }

        private QueryContainer FeatureNameSearchQuery(QueryContainerDescriptor<Feature> q, string searchTerm, string field)
        {
            return q.FunctionScore(
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
            );
        }

        public async Task<List<Feature>> Search(string searchTerm, string fieldName)
        {
            if (string.IsNullOrWhiteSpace(searchTerm))
            {
                return new List<Feature>();
            }
            var field = $"{PROPERTIES}.{fieldName}";
            var response = await _elasticClient.SearchAsync<Feature>(
                s => s.Index(OSM_POIS_ALIAS)
                    .Size(NUMBER_OF_RESULTS)
                    .TrackScores()
                    .Sort(f => f.Descending("_score"))
                    .Query(q => FeatureNameSearchQuery(q, searchTerm, field))
            );
            return response.Documents.ToList();
        }

        public async Task<List<Feature>> SearchPlaces(string place, string fieldName)
        {
            var field = $"{PROPERTIES}.{fieldName}";
            var response = await _elasticClient.SearchAsync<Feature>(
                s => s.Index(OSM_POIS_ALIAS)
                    .Size(5)
                    .TrackScores()
                    .Sort(f => f.Descending("_score"))
                    .Query(
                        q => FeatureNameSearchQuery(q, place, field)
                             && (q.Term(t => t.Field($"{PROPERTIES}.{FeatureAttributes.ICON}").Value("reserve")) ||
                                 q.Term(t => t.Field($"{PROPERTIES}.{FeatureAttributes.ICON}").Value("home")) ||
                                 q.Term(t => t.Field($"{PROPERTIES}.boundary").Value("administrative")) ||
                                 q.Term(t => t.Field($"{PROPERTIES}.landuse").Value("residental")) ||
                                 q.Term(t => t.Field($"{PROPERTIES}.landuse").Value("forest"))
                             )
                    )
            );
            return response.Documents.ToList();
        }

        public async Task<List<Feature>> SearchByLocation(Coordinate nortEast, Coordinate southWest, string searchTerm, string fieldName)
        {
            var field = $"{PROPERTIES}.{fieldName}";
            var response = await _elasticClient.SearchAsync<Feature>(
                s => s.Index(OSM_POIS_ALIAS)
                    .Size(NUMBER_OF_RESULTS)
                    .TrackScores()
                    .Sort(f => f.Descending("_score"))
                    .Query(
                        q => FeatureNameSearchQuery(q, searchTerm, field) &&
                             q.GeoBoundingBox(b => ConvertToGeoBoundingBox(b, nortEast, southWest))
                    )
            );
            return response.Documents.ToList();
        }

        public async Task<List<Feature>> GetContainers(Coordinate coordinate)
        {
            var response = await _elasticClient.SearchAsync<Feature>(
                s => s.Index(OSM_POIS_ALIAS)
                    .Size(100)
                    .Query(q =>
                        q.GeoShapePoint(g =>
                            g.Coordinates(ConvertCoordinate(coordinate))
                                .Field(f => f.Geometry)
                                .Relation(GeoShapeRelation.Contains))
                    )
            );
            return response.Documents.ToList();
        }

        private async Task UpdateZeroDownTime(string index1, string index2, string alias, Func<string, Task> createIndexDelegate, List<Feature> features)
        {
            var currentIndex = index1;
            var newIndex = index2;
            if (_elasticClient.IndexExists(index2).Exists)
            {
                currentIndex = index2;
                newIndex = index1;
            }

            await createIndexDelegate(newIndex);
            await UpdateUsingPaging(features, newIndex);

            await _elasticClient.AliasAsync(a => a
                .Remove(i => i.Alias(alias).Index(currentIndex))
                .Add(i => i.Alias(alias).Index(newIndex))
            );
            await _elasticClient.DeleteIndexAsync(currentIndex);
        }

        public Task UpdateHighwaysZeroDownTime(List<Feature> highways)
        {
            return UpdateZeroDownTime(OSM_HIGHWAYS_INDEX1,
                OSM_HIGHWAYS_INDEX2,
                OSM_HIGHWAYS_ALIAS,
                CreateHighwaysIndex,
                highways);
        }

        public async Task DeleteHighwaysById(string id)
        {
            var fullId = GetId("way", Sources.OSM, id);
            await _elasticClient.DeleteAsync<Feature>(fullId, d => d.Index(OSM_HIGHWAYS_ALIAS));
        }

        public Task UpdatePointsOfInterestZeroDownTime(List<Feature> pointsOfInterest)
        {
            return UpdateZeroDownTime(OSM_POIS_INDEX1,
                OSM_POIS_INDEX2,
                OSM_POIS_ALIAS,
                CreatePointsOfInterestIndex,
                pointsOfInterest);
        }

        public Task UpdateHighwaysData(List<Feature> features)
        {
            return UpdateData(features, OSM_HIGHWAYS_ALIAS);
        }

        public Task UpdatePointsOfInterestData(List<Feature> features)
        {
            return UpdateData(features, OSM_POIS_ALIAS);
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
                result.ItemsWithErrors.ToList().ForEach(i => _logger.LogError($"Inserting {i.Id} failed with error: {i.Error?.Reason ?? string.Empty} caused by: {i.Error?.CausedBy?.Reason ?? string.Empty}"));
            }
        }

        public async Task<List<Feature>> GetHighways(Coordinate northEast, Coordinate southWest)
        {
            var response = await _elasticClient.SearchAsync<Feature>(
                s => s.Index(OSM_HIGHWAYS_ALIAS)
                    .Size(5000).Query(
                        q => q.GeoShapeEnvelope(
                            e => e.Coordinates(new[]
                                {
                                    ConvertCoordinate(northEast),
                                    ConvertCoordinate(southWest),
                                }).Field(f => f.Geometry)
                                .Relation(GeoShapeRelation.Intersects)
                        )
                    )
            );
            return response.Documents.ToList();
        }

        private GeoCoordinate ConvertCoordinate(Coordinate coordinate)
        {
            return new GeoCoordinate(coordinate.Y, coordinate.X);
        }

        public async Task<List<Feature>> GetPointsOfInterest(Coordinate northEast, Coordinate southWest, string[] categories, string language)
        {
            var languages = language == Languages.ALL ? Languages.Array : new[] { language };
            languages = languages.Concat(new[] { Languages.ALL }).ToArray();
            var response = await _elasticClient.SearchAsync<Feature>(
                s => s.Index(OSM_POIS_ALIAS)
                    .Size(10000).Query(
                        q => q.GeoBoundingBox(
                            b => ConvertToGeoBoundingBox(b, northEast,southWest)
                        ) &&
                        q.Terms(t => t.Field($"{PROPERTIES}.{FeatureAttributes.POI_CATEGORY}").Terms(categories.Select(c => c.ToLower()).ToArray())) &&
                        q.Terms(t => t.Field($"{PROPERTIES}.{FeatureAttributes.POI_LANGUAGE}").Terms(languages))
                    )
            );
            return response.Documents.ToList();
        }

        private GeoBoundingBoxQueryDescriptor<Feature> ConvertToGeoBoundingBox(GeoBoundingBoxQueryDescriptor<Feature> b,
            Coordinate northEast, Coordinate southWest)
        {
            return b.BoundingBox(
                bb => bb.TopLeft(new GeoCoordinate(northEast.Y, southWest.X))
                    .BottomRight(new GeoCoordinate(southWest.Y, northEast.X))
            ).Field($"{PROPERTIES}.{FeatureAttributes.GEOLOCATION}");
        }

        public async Task<Feature> GetPointOfInterestById(string id, string source, string type)
        {
            var response = await _elasticClient.SearchAsync<Feature>(
                s => s.Index(OSM_POIS_ALIAS)
                    .Size(1).Query(
                        q => q.Term(t => t.Field($"{PROPERTIES}.{FeatureAttributes.POI_SOURCE}").Value(source.ToLower()))
                             && q.Term(t => t.Field($"{PROPERTIES}.{FeatureAttributes.ID}").Value(id))
                             && q.Term(t => t.Field($"{PROPERTIES}.{FeatureAttributes.OSM_TYPE}").Value(type))
                    )
            );
            return response.Documents.FirstOrDefault();
        }

        public Task DeleteOsmPointOfInterestById(string id, string type)
        {
            var fullId = GetId(type, id, Sources.OSM);
            return _elasticClient.DeleteAsync<Feature>(fullId, d => d.Index(OSM_POIS_ALIAS));
        }

        public Task DeletePointOfInterestById(string id, string source)
        {
            var fullId = GetId(string.Empty, source, id);
            return _elasticClient.DeleteAsync<Feature>(fullId, d => d.Index(OSM_POIS_ALIAS));
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
                c => c.Mappings(ms =>
                    ms.Map<Feature>(m =>
                        m.Properties(ps =>
                            ps.GeoShape(g => g.Name(f => f.Geometry)
                                .Tree(GeoTree.Geohash)
                                .TreeLevels(10)
                                .DistanceErrorPercentage(0.2)))
                    )
                )
            );
        }

        private Task CreatePointsOfInterestIndex(string poisIndexName)
        {
            return _elasticClient.CreateIndexAsync(poisIndexName,
                c => c.Mappings(ms =>
                    ms.Map<Feature>(m =>
                        m.Properties(ps =>
                            ps.Object<AttributesTable>(o => o
                                .Name(PROPERTIES)
                                .Properties(p => p.GeoPoint(s => s.Name(FeatureAttributes.GEOLOCATION)))
                                .Properties(p => p.Keyword(s => s.Name(FeatureAttributes.ID)))
                            ).GeoShape(g => g.Name(f => f.Geometry)
                                .Tree(GeoTree.Geohash)
                                .TreeLevels(10)
                                .DistanceErrorPercentage(0.2))
                        )
                    )
                ).Settings(s => s.Setting("index.mapping.total_fields.limit", 10000))
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
            return GetId(feature.Attributes[FeatureAttributes.OSM_TYPE].ToString(), feature.Attributes[FeatureAttributes.POI_SOURCE]?.ToString() ?? string.Empty, feature.Attributes[FeatureAttributes.ID]?.ToString() ?? string.Empty);
        }

        private string GetId(Rating rating)
        {
            return GetId(rating.Source, rating.Id);
        }

        private string GetId(string elementType, string source, string id)
        {
            return elementType + "_" + GetId(source, id);
        }

        private string GetId(string source, string id)
        {
            return source + "_" + id;
        }

        public Task AddUrl(ShareUrl shareUrl)
        {
            return _elasticClient.IndexAsync(shareUrl, r => r.Index(SHARES).Id(shareUrl.Id));
        }

        public async Task<ShareUrl> GetUrlById(string id)
        {
            var response = await _elasticClient.GetAsync<ShareUrl>(id, r => r.Index(SHARES));
            return response.Source;
        }

        public async Task<List<ShareUrl>> GetUrlsByUser(string osmUserId)
        {
            var response = await _elasticClient.SearchAsync<ShareUrl>(s => s.Index(SHARES).Size(1000)
                .Query(q => q.Term(t => t.OsmUserId, osmUserId)));
            return response.Documents.ToList();

        }

        public Task Delete(ShareUrl shareUrl)
        {
            return _elasticClient.DeleteAsync<ShareUrl>(shareUrl.Id, d => d.Index(SHARES));
        }

        public Task Update(ShareUrl shareUrl)
        {
            return AddUrl(shareUrl);
        }

        public async Task<UserMapLayers> GetUserLayers(string osmUserId)
        {
            var response = await _elasticClient.GetAsync<UserMapLayers>(osmUserId, r => r.Index(USER_LAYERS));
            return response.Source ?? new UserMapLayers { OsmUserId = osmUserId };
        }

        public Task UpdateUserLayers(string osmUserId, UserMapLayers userLayers)
        {
            return _elasticClient.IndexAsync(userLayers, r => r.Index(USER_LAYERS).Id(osmUserId));
        }
    }
}
