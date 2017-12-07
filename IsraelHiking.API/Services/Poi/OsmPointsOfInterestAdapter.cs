using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Net;
using System.Text.RegularExpressions;
using System.Threading.Tasks;
using GeoAPI.Geometries;
using IsraelHiking.API.Executors;
using IsraelHiking.Common;
using IsraelHiking.DataAccessInterfaces;
using NetTopologySuite.Features;
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
            IDataContainerConverterService dataContainerConverterService,
            ITagsHelper tagsHelper) : base(elevationDataStorage, elasticSearchGateway, dataContainerConverterService)
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
            var features = await _elasticSearchGateway.GetPointsOfInterest(northEast, southWest, categories, language);
            var tasks = features.Where(f => IsFeatureAProperPoi(f,language)).Select(f => ConvertToPoiItem<PointOfInterest>(f, language));
            return await Task.WhenAll(tasks);
        }

        /// <inheritdoc />
        public async Task<PointOfInterestExtended> GetPointOfInterestById(string id, string language, string type = null)
        {
            var feature = await _elasticSearchGateway.GetPointOfInterestById(id, Sources.OSM, type);
            return await FeatureToExtendedPoi(feature, language);
        }

        private async Task<PointOfInterestExtended> FeatureToExtendedPoi(Feature feature, string language)
        {
            var poiItem = await ConvertToPoiItem<PointOfInterestExtended>(feature, language);
            await AddExtendedData(poiItem, feature, language);
            poiItem.IsRoute = poiItem.DataContainer.Routes.Any(r => r.Segments.Count > 1);
            poiItem.IsEditable = _tagsHelper.GetAllTags()
                .Any(t => feature.Attributes.GetNames().Contains(t.Key) && feature.Attributes[t.Key].Equals(t.Value));
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
            ICompleteOsmGeo completeOsmGeo;
            if (pointOfInterest.Type == OsmGeoType.Node.ToString().ToLower())
            {
                completeOsmGeo = await osmGateway.GetNode(id);
            }
            else if (pointOfInterest.Type == OsmGeoType.Way.ToString().ToLower())
            {
                completeOsmGeo = await osmGateway.GetCompleteWay(id);
            }
            else if (pointOfInterest.Type == OsmGeoType.Relation.ToString().ToLower())
            {
                completeOsmGeo = await osmGateway.GetCompleteRelation(id);
            }
            else
            {
                throw new ArgumentException(nameof(pointOfInterest.Type) + " is not known: " + pointOfInterest.Type);
            }
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
            RemoveKklRoutes(osmNamesDictionary);
            var geoJsonNamesDictionary = _osmGeoJsonPreprocessorExecutor.Preprocess(osmNamesDictionary);
            return geoJsonNamesDictionary.Values.SelectMany(v => v).ToList();
        }

        private static void RemoveKklRoutes(Dictionary<string, List<ICompleteOsmGeo>> osmNamesDictionary)
        {
            var listOfKeysToRemove = new List<string>();
            foreach (var key in osmNamesDictionary.Keys)
            {
                var list = osmNamesDictionary[key];
                var itemsToRemove = list.Where(osm => osm.Type == OsmGeoType.Relation &&
                                                      osm.Tags.Contains("operator", "kkl") &&
                                                      osm.Tags.Contains("route", "mtb")).ToArray();
                foreach (var itemToRemove in itemsToRemove)
                {
                    list.Remove(itemToRemove);
                }
                if (!list.Any())
                {
                    listOfKeysToRemove.Add(key);
                }
            }
            foreach (var key in listOfKeysToRemove)
            {
                osmNamesDictionary.Remove(key);
            }
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
            return features.Values.FirstOrDefault()?.FirstOrDefault();
        }

        private async Task<Feature> UpdateElasticSearch(ICompleteOsmGeo osm, string name)
        {
            var feature = ConvertOsmToFeature(osm, name);
            if (feature != null)
            {
                await _elasticSearchGateway.UpdatePointsOfInterestData(feature);
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

        private bool IsFeatureAProperPoi(IFeature feature, string language)
        {
            return GetAttributeByLanguage(feature.Attributes, FeatureAttributes.NAME, language) != string.Empty ||
                   GetAttributeByLanguage(feature.Attributes, FeatureAttributes.DESCRIPTION, language) != string.Empty ||
                   feature.Attributes.GetNames().Any(n => n.StartsWith(FeatureAttributes.IMAGE_URL));
        }

        /// <inheritdoc />
        protected override string GetWebsiteUrl(IFeature feature)
        {
            if (feature.Attributes.GetNames().Contains(FeatureAttributes.WIKIPEDIA) == false)
            {
                return base.GetWebsiteUrl(feature);
            }
            var wikipediaTag = feature.Attributes[FeatureAttributes.WIKIPEDIA].ToString();
            if (string.IsNullOrWhiteSpace(wikipediaTag))
            {
                return base.GetWebsiteUrl(feature);
            }
            var splitted = wikipediaTag.Split(':').Where(s => !string.IsNullOrWhiteSpace(s)).ToArray();
            if (splitted.Length != 2)
            {
                return base.GetWebsiteUrl(feature);
            }
            return $"https://{splitted.First()}.wikipedia.org/wiki/{splitted.Last().Trim().Replace(" ", "_")}";
        }

        private void SetWebsiteUrl(TagsCollectionBase tags, PointOfInterestExtended pointOfInterest)
        {
            var regexp = new Regex("((https?://)|^)([a-z]+).wikipedia.org/wiki/(.*)");
            var match = regexp.Match(pointOfInterest.Url ?? string.Empty);
            if (match.Success)
            {
                tags.Add(FeatureAttributes.WIKIPEDIA, match.Groups[3].Value + ":" + WebUtility.UrlDecode(match.Groups[4].Value.Replace("_", " ")));
            }
            else
            {
                tags.Add(FeatureAttributes.WEBSITE, pointOfInterest.Url);
            }
        }
    }
}
