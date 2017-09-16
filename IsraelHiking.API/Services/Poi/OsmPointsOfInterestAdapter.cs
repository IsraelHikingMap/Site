using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Threading.Tasks;
using GeoAPI.Geometries;
using IsraelHiking.API.Executors;
using IsraelHiking.Common;
using IsraelHiking.DataAccessInterfaces;
using NetTopologySuite.Features;
using NetTopologySuite.Geometries;
using OsmSharp;
using OsmSharp.Complete;
using OsmSharp.Tags;

namespace IsraelHiking.API.Services.Poi
{
    /// <summary>
    /// Points of interest adapter for OSM data
    /// </summary>
    public class OsmPointsOfInterestAdapter : BasePointsOfInterestAdapter, IPointsOfInterestAdapter
    {
        private readonly IElasticSearchGateway _elasticSearchGateway;
        private readonly IHttpGatewayFactory _httpGatewayFactory;
        private readonly IOsmGeoJsonPreprocessorExecutor _osmGeoJsonPreprocessorExecutor;
        private readonly IOsmRepository _osmRepository;
        private readonly ITagsHelper _tagsHelper;

        /// <inheritdoc />
        public OsmPointsOfInterestAdapter(IElasticSearchGateway elasticSearchGateway,
            IElevationDataStorage elevationDataStorage,
            IHttpGatewayFactory httpGatewayFactory,
            IOsmGeoJsonPreprocessorExecutor osmGeoJsonPreprocessorExecutor,
            IOsmRepository osmRepository,
            ITagsHelper tagsHelper) : base(elevationDataStorage, elasticSearchGateway)
        {
            _elasticSearchGateway = elasticSearchGateway;
            _httpGatewayFactory = httpGatewayFactory;
            _osmGeoJsonPreprocessorExecutor = osmGeoJsonPreprocessorExecutor;
            _osmRepository = osmRepository;
            _tagsHelper = tagsHelper;
        }
        /// <inheritdoc />
        public string Source => Sources.OSM;

        /// <inheritdoc />
        public async Task<PointOfInterest[]> GetPointsOfInterest(Coordinate northEast, Coordinate southWest, string[] categories, string language)
        {
            var features = await _elasticSearchGateway.GetPointsOfInterest(northEast, southWest, categories);
            return await Task.WhenAll(features.Select(f => ConvertToPoiItem<PointOfInterest>(f, language)));
        }

        /// <inheritdoc />
        public async Task<PointOfInterestExtended> GetPointOfInterestById(string id, string language)
        {
            var feature = await _elasticSearchGateway.GetPointOfInterestById(id, Sources.OSM);
            return await FeatureToExtendedPoi(feature, language);
        }

        private async Task<PointOfInterestExtended> FeatureToExtendedPoi(Feature feature, string language)
        {
            var poiItem = await ConvertToPoiItem<PointOfInterestExtended>(feature, language);
            await AddExtendedData(poiItem, feature, language);
            return poiItem;
        }

        /// <inheritdoc />
        public async Task<PointOfInterestExtended> AddPointOfInterest(PointOfInterestExtended pointOfInterest, TokenAndSecret tokenAndSecret, string language)
        {
            var osmGateway = _httpGatewayFactory.CreateOsmGateway(tokenAndSecret);
            var changesetId = await osmGateway.CreateChangeset("Add POI interface from IHM site.");
            var node = new Node
            {
                Latitude = pointOfInterest.Location.lat,
                Longitude = pointOfInterest.Location.lng,
                Tags = new TagsCollection
                {
                    {FeatureAttributes.IMAGE_URL, pointOfInterest.ImageUrl},
                    {FeatureAttributes.WEBSITE, pointOfInterest.Url}
                }
            };
            SetTagByLanguage(node.Tags, FeatureAttributes.NAME, pointOfInterest.Title, language);
            SetTagByLanguage(node.Tags, FeatureAttributes.DESCRIPTION, pointOfInterest.Description, language);
            AddTagsByIcon(node.Tags, pointOfInterest.Icon);
            RemoveEmptyTags(node.Tags);
            var id = await osmGateway.CreateElement(changesetId, node);
            node.Id = long.Parse(id);
            await osmGateway.CloseChangeset(changesetId);

            var feature = await UpdateElasticSearch(node, pointOfInterest.Title);
            return await FeatureToExtendedPoi(feature, language);
        }

        /// <inheritdoc />
        public async Task<PointOfInterestExtended> UpdatePointOfInterest(PointOfInterestExtended pointOfInterest, TokenAndSecret tokenAndSecret, string language)
        {
            var osmGateway = _httpGatewayFactory.CreateOsmGateway(tokenAndSecret);

            var feature = await _elasticSearchGateway.GetPointOfInterestById(pointOfInterest.Id, Sources.OSM);
            var id = pointOfInterest.Id;
            ICompleteOsmGeo completeOsmGeo;
            if (feature.Geometry is Point)
            {
                completeOsmGeo = await osmGateway.GetNode(id);
            }
            else if (feature.Geometry is LineString || feature.Geometry is Polygon)
            {
                completeOsmGeo = await osmGateway.GetCompleteWay(id);
            }
            else
            {
                completeOsmGeo = await osmGateway.GetCompleteRelation(id);
            }
            SetTagByLanguage(completeOsmGeo.Tags, FeatureAttributes.NAME, pointOfInterest.Title, language);
            SetTagByLanguage(completeOsmGeo.Tags, FeatureAttributes.DESCRIPTION, pointOfInterest.Description, language);
            completeOsmGeo.Tags[FeatureAttributes.IMAGE_URL] = pointOfInterest.ImageUrl;
            completeOsmGeo.Tags[FeatureAttributes.WEBSITE] = pointOfInterest.Url;
            var oldIcon = feature.Attributes[FeatureAttributes.ICON].ToString();
            if (pointOfInterest.Icon != oldIcon)
            {
                RemoveTagsByIcon(completeOsmGeo.Tags, oldIcon);
                AddTagsByIcon(completeOsmGeo.Tags, pointOfInterest.Icon);
            }
            RemoveEmptyTags(completeOsmGeo.Tags);
            var changesetId = await osmGateway.CreateChangeset("Update POI interface from IHM site.");
            await osmGateway.UpdateElement(changesetId, completeOsmGeo);
            await osmGateway.CloseChangeset(changesetId);

            var featureToReturn = await UpdateElasticSearch(completeOsmGeo, pointOfInterest.Title);
            return await FeatureToExtendedPoi(featureToReturn, language);
        }

        /// <inheritdoc />
        public async Task<List<Feature>> GetPointsForIndexing(Stream memoryStream)
        {
            var osmNamesDictionary = await _osmRepository.GetElementsWithName(memoryStream);
            var geoJsonNamesDictionary = _osmGeoJsonPreprocessorExecutor.Preprocess(osmNamesDictionary);
            return geoJsonNamesDictionary.Values.SelectMany(v => v).ToList();
        }

        private async Task<Feature> UpdateElasticSearch(ICompleteOsmGeo osm, string name)
        {
            var features = _osmGeoJsonPreprocessorExecutor.Preprocess(
                new Dictionary<string, List<ICompleteOsmGeo>>
                {
                    {name, new List<ICompleteOsmGeo> {osm}}
                });
            var feature = features.Values.FirstOrDefault()?.FirstOrDefault();
            if (feature != null)
            {
                await _elasticSearchGateway.UpdateNamesData(feature);
            }
            return feature;
        }

        private void SetTagByLanguage(TagsCollectionBase tags, string key, string value, string language)
        {
            var keyWithLanguage = key + ":" + language;
            var previousValue = string.Empty;
            if (tags.ContainsKey(keyWithLanguage))
            {
                previousValue = tags[keyWithLanguage];
                tags[keyWithLanguage] = value;
            }
            else
            {
                tags.Add(new Tag(keyWithLanguage, value));
            }
            if (tags.ContainsKey(key) && tags[key] == previousValue)
            {
                tags[key] = value;
            }
            else if (tags.ContainsKey(key) == false)
            {
                tags.Add(new Tag(key, value));
            }
        }

        private void AddTagsByIcon(TagsCollectionBase tags, string icon)
        {
            var tagsList = _tagsHelper.FindTagsForIcon(icon);
            if (tagsList.Any() == false)
            {
                return;
            }
            tags.Add(tagsList.First().Key, tagsList.First().Value);
        }

        private void RemoveTagsByIcon(TagsCollectionBase tags, string icon)
        {
            var tagsList = _tagsHelper.FindTagsForIcon(icon);
            if (tagsList.Any() == false)
            {
                return;
            }
            foreach (var keyValuePair in tagsList)
            {
                var tag = tags.FirstOrDefault(t => t.Key == keyValuePair.Key && t.Value == keyValuePair.Value);
                if (tag.Equals(default(Tag)) == false)
                {
                    tags.RemoveKeyValue(tag);
                    // removing only one matching tag
                    return;
                }
            }
        }

        private void RemoveEmptyTags(TagsCollectionBase tags)
        {
            for (int i = tags.Count - 1; i >= 0; i--)
            {
                var currentTag = tags.ElementAt(i);
                if (string.IsNullOrWhiteSpace(currentTag.Value))
                {
                    tags.RemoveKeyValue(currentTag);
                }
            }
        }
    }
}
