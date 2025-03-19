﻿using System;
using System.Collections.Generic;
using System.Linq;
using System.Text.RegularExpressions;
using System.Threading.Tasks;
using Elasticsearch.Net;
using IsraelHiking.Common;
using IsraelHiking.Common.Configuration;
using IsraelHiking.Common.Extensions;
using IsraelHiking.DataAccessInterfaces;
using IsraelHiking.DataAccessInterfaces.Repositories;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using Nest;
using NetTopologySuite.Features;
using NetTopologySuite.Geometries;

namespace IsraelHiking.DataAccess.ElasticSearch;

public class ElasticSearchGateway(IOptions<ConfigurationData> options, ILogger logger) :
    IInitializable,
    IPointsOfInterestRepository,
    IHighwaysRepository,
    ISearchRepository,
    IUserLayersRepository,
    IImagesRepository,
    IExternalSourcesRepository,
    IShareUrlsRepository
{
    private readonly ConfigurationData _options = options.Value;
    
    private const int PAGE_SIZE = 10000;
    private const int NUMBER_OF_RESULTS = 20;
    
    private const string PROPERTIES = "properties";
    private const string OSM_HIGHWAYS_INDEX1 = "osm_highways1";
    private const string OSM_HIGHWAYS_INDEX2 = "osm_highways2";
    private const string OSM_HIGHWAYS_ALIAS = "osm_highways";
    private const string SHARES = "shares";
    private const string CUSTOM_USER_LAYERS = "custom_user_layers";
    private const string EXTERNAL_POIS = "external_pois";
    private const string IMAGES = "images";
    private const string REBUILD_LOG = "rebuild_log";
    private const string POINTS = "points";
    private const string BBOX = "bbox";
    
    private IElasticClient _elasticClient;

    public async Task Initialize()
    {
        var uri = _options.ElasticsearchServerAddress;
        var pool = new SingleNodeConnectionPool(new Uri(uri));
        var connectionString = new ConnectionSettings(
                pool,
                new HttpConnection(),
                (_, _) => new SystemTextJsonSerializer(GeoJsonExtensions.GeoJsonWritableFactory))
            .PrettyJson();
        _elasticClient = new ElasticClient(connectionString);
        await InitializeIndexWithAlias(OSM_HIGHWAYS_INDEX1, OSM_HIGHWAYS_INDEX2, OSM_HIGHWAYS_ALIAS, CreateHighwaysIndex);

        if ((await _elasticClient.Indices.ExistsAsync(SHARES)).Exists == false)
        {
            await CreateSharesIndex();
        }
        if ((await _elasticClient.Indices.ExistsAsync(CUSTOM_USER_LAYERS)).Exists == false)
        {
            await _elasticClient.Indices.CreateAsync(CUSTOM_USER_LAYERS);
        }
        if ((await _elasticClient.Indices.ExistsAsync(IMAGES)).Exists == false)
        {
            await CreateImagesIndex();
        }
        logger.LogInformation("Finished initialing elasticsearch with uri: " + uri);
    }

    private async Task InitializeIndexWithAlias(string index1, string index2, string alias, Func<string, Task> creatIndexAction)
    {
        if ((await _elasticClient.Indices.ExistsAsync(index1)).Exists == false &&
            (await _elasticClient.Indices.ExistsAsync(index2)).Exists == false)
        {
            await creatIndexAction(index1);
            await _elasticClient.Indices.BulkAliasAsync(a => a.Add(add => add.Alias(alias).Index(index1)));
            logger.LogInformation($"Initialing elasticsearch alias: {alias}, no indices existed");
            return;
        }

        if ((await _elasticClient.Indices.ExistsAsync(index1)).Exists &&
            (await _elasticClient.GetIndicesPointingToAliasAsync(alias)).Contains(index1))
        {
            return;
        }
        if ((await _elasticClient.Indices.ExistsAsync(index2)).Exists &&
            (await _elasticClient.GetIndicesPointingToAliasAsync(alias)).Contains(index2))
        {
            return;
        }

        if ((await _elasticClient.Indices.ExistsAsync(index1)).Exists)
        {
            await _elasticClient.Indices.BulkAliasAsync(a => a.Add(add => add.Alias(alias).Index(index1)));
            logger.LogWarning($"Initialing elasticsearch alias: {alias}, for index {index1}, index existed without alias");
            return;
        }
            
        if ((await _elasticClient.Indices.ExistsAsync(index2)).Exists)
        {
            await _elasticClient.Indices.BulkAliasAsync(a => a.Add(add => add.Alias(alias).Index(index2)));
            logger.LogWarning($"Initialing elasticsearch alias: {alias}, for index {index2}, index existed without alias");
        }
    }
        
    private List<IHit<T>> GetAllItemsByScrolling<T>(ISearchResponse<T> response) where T: class
    {
        var list = new List<IHit<T>>();
        list.AddRange(response.Hits.ToList());
        var results = _elasticClient.Scroll<T>("10s", response.ScrollId);
        list.AddRange(results.Hits.ToList());
        while (results.Documents.Any())
        {
            results = _elasticClient.Scroll<T>("10s", results.ScrollId);
            list.AddRange(results.Hits.ToList());
        }
        _elasticClient.ClearScroll(new ClearScrollRequest(response.ScrollId));
        return list;
    }

    /// <summary>
    /// This method is used to extract the field with the highest contribution to the score
    /// It uses the explanation object to recursively find the field
    /// </summary>
    /// <param name="exp"></param>
    /// <returns></returns>
    private string FindBestField(ExplanationDetail exp)
    {
        // Extract the field from the explanation
        var match = Regex.Match(exp.Description, @"weight\((.*)\)");
        if (match.Success)
        {
            return match.Groups[1].Value;
        }

        // Recursively check child explanations
        foreach (var child in exp.Details)
        {
            var childResult = FindBestField(child);
            if (!string.IsNullOrEmpty(childResult))
                return childResult;
        }

        return null;
    }
    
    /// <summary>
    /// This method is used to find the language with the highest contribution to the score
    /// </summary>
    /// <param name="explanation">The explanination object from the query results</param>
    /// <param name="fallbackLanguage">The language to use in case no matching language was found</param>
    /// <returns></returns>
    private string GetBestMatchLanguage(Explanation explanation, string fallbackLanguage)
    {
        // Recursive method to find the field with the highest contribution to the score
        foreach (var details in explanation?.Details ?? [])
        {
            var results = FindBestField(details);
            if (!string.IsNullOrEmpty(results) && Languages.ArrayWithDefault.Any(l => results.Contains("." + l)))
            {
                return Languages.ArrayWithDefault.First(l => results.Contains("." + l));
            }
        }
        return fallbackLanguage;
    }
    
    private IFeature HitToFeature(IHit<PointDocument> d, string language)
    {
        var searchTermLanguage = GetBestMatchLanguage(d.Explanation, language);
        IFeature feature = new Feature(new Point(d.Source.Location[0], d.Source.Location[1]), new AttributesTable
        {
            { FeatureAttributes.NAME, d.Source.Name.GetValueOrDefault(searchTermLanguage, d.Source.Name.GetValueOrDefault(Languages.DEFAULT, string.Empty)) },
            { FeatureAttributes.POI_SOURCE, d.Source.PoiSource },
            { FeatureAttributes.POI_ICON, d.Source.PoiIcon },
            { FeatureAttributes.POI_CATEGORY, d.Source.PoiCategory },
            { FeatureAttributes.POI_ICON_COLOR, d.Source.PoiIconColor },
            { FeatureAttributes.DESCRIPTION, d.Source.Description.GetValueOrDefault(searchTermLanguage, d.Source.Description.GetValueOrDefault(Languages.DEFAULT, string.Empty)) },
            { FeatureAttributes.POI_ID, d.Id },
            { FeatureAttributes.POI_LANGUAGE, Languages.ALL },
            { FeatureAttributes.ID, string.Join("_", d.Id.Split("_").Skip(1)) }
        });
        if (!string.IsNullOrWhiteSpace(d.Source.Image))
        {
            feature.Attributes.AddOrUpdate(FeatureAttributes.IMAGE_URL, d.Source.Image);
        }
        feature.SetTitles();
        feature.SetLocation(new Coordinate(d.Source.Location[0], d.Source.Location[1]));
        return feature;
    }
    
    private QueryContainer DocumentNameSearchQuery<T>(QueryContainerDescriptor<T> q, string searchTerm) where T: class
    {
        return q.DisMax(dm =>
            dm.Queries(sh =>
                    sh.MultiMatch(m =>
                        m.Type(TextQueryType.Phrase)
                        .Query(searchTerm)
                        .Boost(5)
                        .Fields(f => f.Fields(Languages.ArrayWithDefault.Select(l => new Field("name." + l + ".keyword"))))
                    ),
                sh => 
                    sh.MultiMatch(m =>
                    m.Type(TextQueryType.BestFields)
                        .Query(searchTerm)
                        .Fuzziness(Fuzziness.Auto)
                        .Fields(f => f.Fields(Languages.ArrayWithDefault.Select(l => new Field("name." + l))))
                )
            )
        );
    }
        
    public async Task<List<IFeature>> Search(string searchTerm, string language)
    {
        if (string.IsNullOrWhiteSpace(searchTerm))
        {
            return [];
        }

        var response = await _elasticClient.SearchAsync<PointDocument>(s => s.Index(POINTS)
            .Size(NUMBER_OF_RESULTS)
            .TrackScores()
            .Sort(f => f.Descending("_score"))
            .Query(q => DocumentNameSearchQuery(q, searchTerm))
            .Explain()
        );
        return response.Hits.Select(d=> HitToFeature(d, language)).ToList();
    }
        
    public async Task<List<IFeature>> SearchExact(string searchTerm, string language)
    {
        if (string.IsNullOrWhiteSpace(searchTerm))
        {
            return [];
        }

        var response = await _elasticClient.SearchAsync<PointDocument>(s => s.Index(POINTS)
            .Size(NUMBER_OF_RESULTS)
            .TrackScores()
            .Sort(f => f.Descending("_score"))
            .Query(q => 
                q.MultiMatch(m =>
                    m.Type(TextQueryType.Phrase)
                        .Query(searchTerm)
                        .Fields(f => f.Fields(Languages.ArrayWithDefault.Select(l => new Field("name." + l + ".keyword"))))
                )
            ).Explain()
        );
        return response.Hits.Select(d=> HitToFeature(d, language)).ToList();
    }

    public async Task<List<IFeature>> SearchPlaces(string searchTerm, string language)
    {
        var split = searchTerm.Split(',');
        var place = split.Last().Trim();
        searchTerm = split.First().Trim();
        if (string.IsNullOrWhiteSpace(searchTerm) || string.IsNullOrWhiteSpace(place))
        {
            return [];
        }
        var placesResponse = await _elasticClient.SearchAsync<BBoxDocument>(s => s.Index(BBOX)
            .Size(1)
            .TrackScores()
            .Sort(f => f.Descending("_score"))
            .Query(q => DocumentNameSearchQuery(q, place))
        );
        if (placesResponse.Documents.Count == 0)
        {
            return [];
        }
        var response = await _elasticClient.SearchAsync<PointDocument>(s => s.Index(POINTS)
            .Size(NUMBER_OF_RESULTS)
            .TrackScores()
            .Sort(f => f.Descending("_score"))
            .Query(q => DocumentNameSearchQuery(q, searchTerm) &&
                q.GeoShape(b =>
                {
                    b.Field(p => p.Location);
                    b.Relation(GeoShapeRelation.Within);
                    return placesResponse.Documents.First().BBox switch
                    {
                        EnvelopeBBoxShape envelope => b.Shape(sh =>
                                sh.Envelope(envelope.Coordinates.Select(c => new GeoCoordinate(c[1], c[0])))),
                        PolygonBBoxShape poly => b.Shape(sh =>
                            sh.Polygon(poly.Coordinates.Select(
                                p => p.Select(c => new GeoCoordinate(c[1], c[0]))))),
                        MultiPolygonBBoxShape multi => b.Shape(sh =>
                            sh.MultiPolygon(multi.Coordinates.Select(mp =>
                                mp.Select(p => p.Select(c => new GeoCoordinate(c[1], c[0])))))),
                        _ => throw new Exception("Unsupported shape type")
                    };
                })
            )
        );
        return response.Hits.Select(d => HitToFeature(d, language)).ToList();
    }

    public async Task<string> GetContainerName(Coordinate[] coordinates, string language)
    {
        var response = await _elasticClient.SearchAsync<BBoxDocument>(
            s => s.Index(BBOX)
                .Size(1)
                .Sort(f => f.Ascending(a => a.Area))
                .Query(q =>
                    q.GeoShape(g =>
                        g.Shape(sh =>
                            {
                                if (coordinates.Length == 1)
                                {
                                    return sh.Point(ConvertCoordinate(coordinates[0]));    
                                }

                                return sh.Envelope([
                                    new GeoCoordinate(coordinates.Max(c => c.Y), coordinates.Min(c => c.X)),
                                    new GeoCoordinate(coordinates.Min(c => c.Y), coordinates.Max(c => c.X))
                                ]);

                            })
                            // For some reason the field is not recognized as a field
                            .Field("bbox")
                            .Relation(GeoShapeRelation.Contains))
                )
        );
        return response.Documents.FirstOrDefault()?.Name.GetValueOrDefault(language, null);
    }

    private (string currentIndex, string newIndex) GetIndicesStatus(string index1, string index2, string alias)
    {
        var currentIndex = index1;
        var newIndex = index2;
        if (_elasticClient.GetIndicesPointingToAlias(alias).Contains(index2))
        {
            currentIndex = index2;
            newIndex = index1;
        }
        return (currentIndex, newIndex);
    }

    private async Task SwitchIndices(string currentIndex, string newIndex, string alias)
    {
        await _elasticClient.Indices.BulkAliasAsync(a => a
            .Remove(i => i.Alias(alias).Index(currentIndex))
            .Add(i => i.Alias(alias).Index(newIndex))
        );
        await _elasticClient.Indices.DeleteAsync(currentIndex);
    }

    public async Task UpdateHighwaysZeroDownTime(List<IFeature> highways)
    {
        var (currentIndex, newIndex) = GetIndicesStatus(OSM_HIGHWAYS_INDEX1, OSM_HIGHWAYS_INDEX2, OSM_HIGHWAYS_ALIAS);

        await CreateHighwaysIndex(newIndex);
        await UpdateUsingPaging(highways, newIndex);

        await SwitchIndices(currentIndex, newIndex, OSM_HIGHWAYS_ALIAS);
    }

    public Task UpdateHighwaysData(List<IFeature> features)
    {
        return UpdateData(features, OSM_HIGHWAYS_ALIAS);
    }

    private async Task UpdateData(List<IFeature> features, string alias)
    {
        var result = await _elasticClient.BulkAsync(bulk =>
        {
            foreach (var feature in features)
            {
                bulk.Index<IFeature>(i => i.Index(alias).Document(feature).Id(feature.GetId()));
            }
            return bulk;
        });
        if (result.IsValid == false)
        {
            result.ItemsWithErrors.ToList().ForEach(i => logger.LogError($"Inserting {i.Id} failed with error: {i.Error?.Reason ?? string.Empty} caused by: {i.Error?.CausedBy?.Reason ?? string.Empty}"));
        }
    }

    public async Task<List<IFeature>> GetHighways(Coordinate northEast, Coordinate southWest)
    {
        var response = await _elasticClient.SearchAsync<IFeature>(
            s => s.Index(OSM_HIGHWAYS_ALIAS)
                .Size(5000)
                .Query(
                    q => q.GeoShape(g => 
                        g.Shape(sh => sh.Envelope(ConvertCoordinate(new Coordinate(southWest.X, northEast.Y)), ConvertCoordinate(new Coordinate(northEast.X, southWest.Y))))
                            .Field(f => f.Geometry)
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

    public async Task<IFeature> GetClosestPoint(Coordinate coordinate, string source, string language)
    {
        var distance = _options.ClosestPointsOfInterestThreshold;
        var response = await _elasticClient.SearchAsync<PointDocument>(s =>
            s.Index(POINTS)
            .Size(1)
            .Query(q =>
            {
                var query = q.GeoBoundingBox(b => b.BoundingBox(
                        bb => bb.TopLeft(new GeoCoordinate(coordinate.Y + distance, coordinate.X - distance))
                            .BottomRight(new GeoCoordinate(coordinate.Y - distance, coordinate.X + distance))
                    ).Field(p => p.Location))
                    && q.Bool(b => b.MustNot(mn => mn.Term(t => t.Field(p => p.PoiIcon).Value("icon-search"))));
                if (!string.IsNullOrWhiteSpace(source))
                {
                    query = query && q.Term(t => t.Field(p => p.PoiSource).Value(source.ToLower()));
                }
                return query;
            })
            .Sort(ss => ss
                .GeoDistance(g => g
                    .Field(p => p.Location)
                    .Points(new GeoCoordinate(coordinate.Y, coordinate.X))
                    .Order(SortOrder.Ascending)
                )
            )
        );
        return response.Hits.Select(d => HitToFeature(d, language ?? Languages.DEFAULT)).FirstOrDefault();

    }

    public async Task<List<IFeature>> GetAllPointsOfInterest()
    {
        await _elasticClient.Indices.RefreshAsync(POINTS);
        var response = await _elasticClient.SearchAsync<PointDocument>(s => s.Index(POINTS)
            .Size(PAGE_SIZE)
            .Scroll("10s")
            .Query(q =>
                q.Bool(b => 
                    b.MustNot(mn => 
                        mn.Term(t => t.Field(p => p.PoiIcon).Value("icon-search"))
                    )
                )
            )
        );
        var list = GetAllItemsByScrolling(response);
        return list.Select(h => HitToFeature(h, Languages.DEFAULT)).ToList();
    }

    public async Task<List<IFeature>> GetExternalPoisBySource(string source)
    {
        var response = await _elasticClient.SearchAsync<IFeature>(
            s => s.Index(EXTERNAL_POIS)
                .Size(10000)
                .Scroll("10s")
                .Query(q =>
                    q.Term(t => t.Field($"{PROPERTIES}.{FeatureAttributes.POI_SOURCE}").Value(source.ToLower()))
                )
        );
        var features = GetAllItemsByScrolling(response);
        logger.LogInformation($"Got {features.Count} features for source {source}");
        return features.Select(f => f.Source).ToList();
    }

    public async Task<IFeature> GetExternalPoiById(string id, string source)
    {
        var response = await _elasticClient.GetAsync<IFeature>(GeoJsonExtensions.GetId(source, id), r => r.Index(EXTERNAL_POIS));
        return response.Source;
    }

    public async Task AddExternalPois(List<IFeature> features)
    {
        if ((await _elasticClient.Indices.ExistsAsync(EXTERNAL_POIS)).Exists == false)
        {
            await CreateExternalPoisIndex();
        }
        await UpdateData(features, EXTERNAL_POIS);
    }

    public Task DeleteExternalPoisBySource(string source)
    {
        return _elasticClient.DeleteByQueryAsync<IFeature>(d =>
            d.Index(EXTERNAL_POIS)
                .Query(q =>
                    q.Term(t => t.Field($"{PROPERTIES}.{FeatureAttributes.POI_SOURCE}").Value(source.ToLower()))
                )
        );
    }

    private Task CreateHighwaysIndex(string highwaysIndexName)
    {
        return _elasticClient.Indices.CreateAsync(highwaysIndexName,
            c => c.Map<IFeature>(m =>
                m.Dynamic(false)
                    .Properties(ps =>
                        ps.GeoShape(g =>
                            g.Name(f => f.Geometry)
                        )
                    )
            )
        );
    }

    private Task CreateExternalPoisIndex()
    {
        return _elasticClient.Indices.CreateAsync(EXTERNAL_POIS,
            c => c.Map<IFeature>(m =>
                m.Properties(fp =>
                    fp.Object<IAttributesTable>(a => a
                        .Name(PROPERTIES)
                        .Properties(p => p.Keyword(s => s.Name(FeatureAttributes.ID)))
                    )
                )
            ).Settings(s => s.Setting("index.mapping.total_fields.limit", 10000))
        );
    }

    private Task CreateImagesIndex()
    {
        return _elasticClient.Indices.CreateAsync(IMAGES, c =>
            c.Map<ImageItem>(m =>
                m.Properties(p =>
                    p.Keyword(k => k.Name(ii => ii.Hash))
                        .Keyword(s => s.Name(n => n.ImageUrls))
                        .Binary(a => a.Name(i => i.Thumbnail))
                )
            )
        );
    }

    private Task CreateSharesIndex()
    {
        return _elasticClient.Indices.CreateAsync(SHARES,
            c => c.Map<ShareUrl>(m => m.AutoMap<ShareUrl>())
        );
    }
    private async Task UpdateUsingPaging(List<IFeature> features, string alias)
    {
        logger.LogInformation($"Starting indexing {features.Count} records");
        var smallCacheList = new List<IFeature>(PAGE_SIZE);
        int total = 0;
        foreach (var feature in features)
        {
            smallCacheList.Add(feature);
            if (smallCacheList.Count < PAGE_SIZE)
            {
                continue;
            }
            total += smallCacheList.Count;
            await UpdateData(smallCacheList, alias);
            logger.LogDebug($"Indexed {total} records of {features.Count}");
            smallCacheList.Clear();
        }
        await UpdateData(smallCacheList, alias);
        logger.LogInformation($"Finished indexing {features.Count} records");
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
    public async Task<DateTime> GetUrlTimestampById(string id)
    {
        var response = await _elasticClient.GetAsync<ShareUrl>(id, r => r.Index(SHARES).SourceIncludes(e => e.LastModifiedDate, e=> e.CreationDate));
        if (response.Source == null) {
            return DateTime.MinValue;
        }
        response.Source.FixModifiedDate();
        return response.Source.LastModifiedDate;
    }

    public async Task<List<ShareUrl>> GetUrlsByUser(string osmUserId)
    {
        var response = await _elasticClient.SearchAsync<ShareUrl>(s => s.Index(SHARES)
            .Size(5000)
            .Query(q => q.Term(t => t.OsmUserId, osmUserId))
            .Source(src => src
                .IncludeAll()
                .Excludes(e => e.Fields(p => p.DataContainer))
            )
        );
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

    public async Task<List<MapLayerData>> GetUserLayers(string osmUserId)
    {
        var response = await _elasticClient.SearchAsync<MapLayerData>(s => s.Index(CUSTOM_USER_LAYERS).Size(1000)
            .Query(q => q.Term(t => t.OsmUserId, osmUserId)));
        var layers = response.Documents.ToList();
        return response.Hits.Select((h, i) =>
        {
            layers[i].Id = h.Id;
            return layers[i];
        }).ToList();
    }

    public async Task<MapLayerData> GetUserLayerById(string id)
    {
        var response = await _elasticClient.GetAsync<MapLayerData>(id, r => r.Index(CUSTOM_USER_LAYERS));
        response.Source.Id = id;
        return response.Source;
    }

    public async Task<MapLayerData> AddUserLayer(MapLayerData layerData)
    {
        var response = await _elasticClient.IndexAsync(layerData, r => r.Index(CUSTOM_USER_LAYERS));
        layerData.Id = response.Id;
        return layerData;
    }

    public Task UpdateUserLayer(MapLayerData layerData)
    {
        return _elasticClient.IndexAsync(layerData, r => r.Index(CUSTOM_USER_LAYERS).Id(layerData.Id));
    }

    public Task DeleteUserLayer(MapLayerData layerData)
    {
        return _elasticClient.DeleteAsync<MapLayerData>(layerData.Id, d => d.Index(CUSTOM_USER_LAYERS));
    }

    public async Task<ImageItem> GetImageByUrl(string url)
    {
        var response = await _elasticClient.SearchAsync<ImageItem>(s =>
            s.Index(IMAGES)
                .Query(q => q.Match(m => m.Field(i => i.ImageUrls).Query(url)))
        );
        return response.Documents.FirstOrDefault();
    }

    public async Task<ImageItem> GetImageByHash(string hash)
    {
        var response = await _elasticClient.GetAsync<ImageItem>(hash, r => r.Index(IMAGES));
        return response.Source;
    }
    public async Task<List<string>> GetAllUrls()
    {
        await _elasticClient.Indices.RefreshAsync(IMAGES);
        var response = await _elasticClient.SearchAsync<ImageItem>(
            s => s.Index(IMAGES)
                .Size(10000)
                .Scroll("10s")
                .Source(sf => sf
                    .Includes(i => i.Fields(f => f.ImageUrls, f => f.Hash))
                ).Query(q => q.MatchAll())
        );
        var list = GetAllItemsByScrolling(response);
        return list.SelectMany(i => i.Source.ImageUrls ?? []).ToList();
    }

    public Task StoreImage(ImageItem imageItem)
    {
        return _elasticClient.IndexAsync(imageItem, r => r.Index(IMAGES).Id(imageItem.Hash));
    }

    public async Task DeleteImageByUrl(string url)
    {
        var imageItem = await GetImageByUrl(url);
        if (imageItem != null)
        {
            await _elasticClient.DeleteAsync<IFeature>(imageItem.Hash, d => d.Index(IMAGES));
        }
    }

    public Task StoreRebuildContext(RebuildContext context)
    {
        return _elasticClient.IndexAsync(context, r => r.Index(REBUILD_LOG).Id(context.StartTime.ToString("o")));
    }
}