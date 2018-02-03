using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Text.RegularExpressions;
using System.Threading.Tasks;
using GeoAPI.Geometries;
using IsraelHiking.API.Executors;
using IsraelHiking.Common;
using IsraelHiking.Common.Extensions;
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
        private readonly IHttpGatewayFactory _httpGatewayFactory;
        private readonly IOsmGeoJsonPreprocessorExecutor _osmGeoJsonPreprocessorExecutor;
        private readonly IOsmRepository _osmRepository;
        private readonly IWikipediaGateway _wikipediaGateway;
        private readonly ITagsHelper _tagsHelper;

        /// <inheritdoc />
        public OsmPointsOfInterestAdapter(IElasticSearchGateway elasticSearchGateway,
            IElevationDataStorage elevationDataStorage,
            IHttpGatewayFactory httpGatewayFactory,
            IOsmGeoJsonPreprocessorExecutor osmGeoJsonPreprocessorExecutor,
            IOsmRepository osmRepository,
            IDataContainerConverterService dataContainerConverterService,
            IWikipediaGateway wikipediaGateway,
            ITagsHelper tagsHelper) : base(elevationDataStorage, elasticSearchGateway, dataContainerConverterService)
        {
            _httpGatewayFactory = httpGatewayFactory;
            _osmGeoJsonPreprocessorExecutor = osmGeoJsonPreprocessorExecutor;
            _osmRepository = osmRepository;
            _wikipediaGateway = wikipediaGateway;
            _tagsHelper = tagsHelper;
        }
        /// <inheritdoc />
        public string Source => Sources.OSM;

        /// <inheritdoc />
        public async Task<PointOfInterest[]> GetPointsOfInterest(Coordinate northEast, Coordinate southWest, string[] categories, string language)
        {
            var features = await _elasticSearchGateway.GetPointsOfInterest(northEast, southWest, categories, language);
            var tasks = features.Where(f => IsFeatureAProperPoi(f,language)).Select(f => ConvertToPoiItem<PointOfInterest>(f, language));
            return await Task.WhenAll(tasks);
        }

        /// <inheritdoc />
        public async Task<PointOfInterestExtended> GetPointOfInterestById(string id, string language, string type = null)
        {
            IFeature feature = await _elasticSearchGateway.GetPointOfInterestById(id, Sources.OSM, type);
            if (feature.Attributes.GetWikipediaTitle(language) == string.Empty ||
                GetAttributeByLanguage(feature.Attributes, FeatureAttributes.DESCRIPTION, language) != string.Empty ||
                feature.Attributes.Exists(FeatureAttributes.IMAGE_URL))
            {
                return await FeatureToExtendedPoi(feature, language);
            }
            // OSM+Wikipedia POI
            var title = feature.Attributes.GetWikipediaTitle(language);
            var featureCollection = await _wikipediaGateway.GetByPageTitle(title, language);
            if (featureCollection == null)
            {
                // Invalid page
                return await FeatureToExtendedPoi(feature, language);
            }
            var wikiFeature = featureCollection.Features.First();
            foreach (var wikiFeatureAttributeKey in wikiFeature.Attributes.GetNames())
            {
                if (feature.Attributes.Exists(wikiFeatureAttributeKey))
                {
                    continue;
                }
                feature.Attributes.AddAttribute(wikiFeatureAttributeKey, wikiFeature.Attributes[wikiFeatureAttributeKey]);
            }
            return await FeatureToExtendedPoi(feature, language);
        }

        private async Task<PointOfInterestExtended> FeatureToExtendedPoi(IFeature feature, string language)
        {
            var poiItem = await ConvertToPoiItem<PointOfInterestExtended>(feature, language);
            await AddExtendedData(poiItem, feature, language);
            poiItem.IsArea = feature.Geometry is Polygon || feature.Geometry is MultiPolygon;
            poiItem.IsRoute = !poiItem.IsArea && poiItem.DataContainer.Routes.Any(r => r.Segments.Count > 1);
            poiItem.IsEditable = true;
            return poiItem;
        }

        /// <inheritdoc />
        public async Task<PointOfInterestExtended> AddPointOfInterest(PointOfInterestExtended pointOfInterest, TokenAndSecret tokenAndSecret, string language)
        {
            var osmGateway = _httpGatewayFactory.CreateOsmGateway(tokenAndSecret);
            var changesetId = await osmGateway.CreateChangeset("Add POI interface from IHM site.");
            var node = new Node
            {
                Latitude = pointOfInterest.Location.Lat,
                Longitude = pointOfInterest.Location.Lng,
                Tags = new TagsCollection()
            };
            SetWebsiteUrl(node.Tags, pointOfInterest);
            for (var imageIndex = 0; imageIndex < pointOfInterest.ImagesUrls.Length; imageIndex++)
            {
                var imageUrl = pointOfInterest.ImagesUrls[imageIndex];
                var tagName = imageIndex == 0 ? FeatureAttributes.IMAGE_URL : FeatureAttributes.IMAGE_URL + imageIndex;
                node.Tags.Add(tagName, imageUrl);
            }
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
            var id = pointOfInterest.Id;
            ICompleteOsmGeo completeOsmGeo = await osmGateway.GetElement(id, pointOfInterest.Type);
            var featureBeforeUpdate = ConvertOsmToFeature(completeOsmGeo, pointOfInterest.Title);
            var oldIcon = featureBeforeUpdate.Attributes[FeatureAttributes.ICON].ToString();
            var oldTags = completeOsmGeo.Tags.ToArray();

            SetWebsiteUrl(completeOsmGeo.Tags, pointOfInterest);
            SetTagByLanguage(completeOsmGeo.Tags, FeatureAttributes.NAME, pointOfInterest.Title, language);
            SetTagByLanguage(completeOsmGeo.Tags, FeatureAttributes.DESCRIPTION, pointOfInterest.Description, language);
            SyncImages(completeOsmGeo.Tags, pointOfInterest.ImagesUrls);
            if (pointOfInterest.Icon != oldIcon)
            {
                RemoveTagsByIcon(completeOsmGeo.Tags, oldIcon);
                AddTagsByIcon(completeOsmGeo.Tags, pointOfInterest.Icon);
            }
            RemoveEmptyTags(completeOsmGeo.Tags);
            if (AreTagsCollectionEqual(oldTags, completeOsmGeo.Tags.ToArray()))
            {
                var feature = ConvertOsmToFeature(completeOsmGeo, pointOfInterest.Title);
                return await FeatureToExtendedPoi(feature, language);
            }

            var changesetId = await osmGateway.CreateChangeset("Update POI interface from IHM site.");
            await osmGateway.UpdateElement(changesetId, completeOsmGeo);
            await osmGateway.CloseChangeset(changesetId);

            var featureToReturn = await UpdateElasticSearch(completeOsmGeo, pointOfInterest.Title);
            return await FeatureToExtendedPoi(featureToReturn, language);
        }

        private bool AreTagsCollectionEqual(Tag[] oldTags, Tag[] currentTags)
        {
            if (oldTags.Length != currentTags.Length)
            {
                return false;
            }
            foreach (var currentTag in currentTags)
            {
                if (!oldTags.Any(t => t.Equals(currentTag)))
                {
                    return false;
                }
            }
            return true;
        }

        /// <inheritdoc />
        public async Task<List<Feature>> GetPointsForIndexing(Stream memoryStream)
        {
            var osmNamesDictionary = await _osmRepository.GetElementsWithName(memoryStream);
            var relevantTagsDictionary = _tagsHelper.GetAllTags();
            var namelessNodes = await _osmRepository.GetPointsWithNoNameByTags(memoryStream, relevantTagsDictionary);
            osmNamesDictionary.Add(string.Empty, namelessNodes.Cast<ICompleteOsmGeo>().ToList());
            var features = _osmGeoJsonPreprocessorExecutor.Preprocess(osmNamesDictionary);
            var containers = features.Where(f => f.IsValidContainer())
                .OrderBy(f => f.Geometry.Area).ToList();
            return _osmGeoJsonPreprocessorExecutor.AddAddress(features, containers);
        }

        private void SyncImages(TagsCollectionBase tags, string[] images)
        {
            var tagsToRemove = tags.Where(t => t.Key.StartsWith(FeatureAttributes.IMAGE_URL) && images.Contains(t.Value) == false).ToArray();
            foreach (var tag in tagsToRemove)
            {
                tags.RemoveKeyValue(tag);
            }
            var imagesToAdd = images.Where(i => tags.Any(t => t.Value == i) == false).ToList();
            foreach (var imageUrl in imagesToAdd)
            {
                if (!tags.ContainsKey(FeatureAttributes.IMAGE_URL))
                {
                    tags[FeatureAttributes.IMAGE_URL] = imageUrl;
                    continue;
                }
                int imageIndex = 1;
                while (tags.ContainsKey(FeatureAttributes.IMAGE_URL + imageIndex))
                {
                    imageIndex++;
                }
                tags[FeatureAttributes.IMAGE_URL + imageIndex] = imageUrl;
            }
        }

        private Feature ConvertOsmToFeature(ICompleteOsmGeo osm, string name)
        {
            var features = _osmGeoJsonPreprocessorExecutor.Preprocess(
                new Dictionary<string, List<ICompleteOsmGeo>>
                {
                    {name ?? string.Empty, new List<ICompleteOsmGeo> {osm}}
                });
            return features.FirstOrDefault();
        }

        private async Task<Feature> UpdateElasticSearch(ICompleteOsmGeo osm, string name)
        {
            var feature = ConvertOsmToFeature(osm, name);
            if (feature != null)
            {
                await _elasticSearchGateway.UpdatePointsOfInterestData(new List<Feature> {feature});
                foreach (var language in Languages.Array)
                {
                    var title = feature.Attributes.GetWikipediaTitle(language);
                    if (string.IsNullOrWhiteSpace(title))
                    {
                        continue;
                    }
                    var pageFetaure = await _wikipediaGateway.GetByPageTitle(title, language);
                    if (pageFetaure == null)
                    {
                        continue;
                    }
                    await _elasticSearchGateway.DeletePointOfInterestById(pageFetaure.Features.First().Attributes[FeatureAttributes.ID].ToString(), Sources.WIKIPEDIA);
                }
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
            if (tagsList.Any())
            {
                tags.Add(tagsList.First().Key, tagsList.First().Value);
            }
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

        private bool IsFeatureAProperPoi(IFeature feature, string language)
        {
            return GetAttributeByLanguage(feature.Attributes, FeatureAttributes.NAME, language) != string.Empty ||
                   GetAttributeByLanguage(feature.Attributes, FeatureAttributes.DESCRIPTION, language) != string.Empty ||
                   feature.Attributes.GetNames().Any(n => n.StartsWith(FeatureAttributes.IMAGE_URL));
        }

        private void SetWebsiteUrl(TagsCollectionBase tags, PointOfInterestExtended pointOfInterest)
        {
            var regexp = new Regex("((https?://)|^)([a-z]+).wikipedia.org/wiki/(.*)");
            var match = regexp.Match(pointOfInterest.Url ?? string.Empty);
            if (match.Success)
            {
                SetTagByLanguage(tags, 
                    FeatureAttributes.WIKIPEDIA,
                    Uri.UnescapeDataString(match.Groups[4].Value.Replace("_", " ")), 
                    match.Groups[3].Value);
            }
            else
            {
                tags.Add(FeatureAttributes.WEBSITE, pointOfInterest.Url);
            }
        }

        /// <inheritdoc />
        protected override string GetWebsiteUrl(IFeature feature, string language)
        {
            return WebsiteUrlFeatureHelper.GetWikipediaUrl(feature, language);
        }
    }
}
