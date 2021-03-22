using IsraelHiking.API.Converters;
using IsraelHiking.API.Executors;
using IsraelHiking.API.Gpx;
using IsraelHiking.API.Services.Osm;
using IsraelHiking.Common;
using IsraelHiking.Common.Api;
using IsraelHiking.Common.Configuration;
using IsraelHiking.Common.Extensions;
using IsraelHiking.Common.Poi;
using IsraelHiking.DataAccessInterfaces;
using IsraelHiking.DataAccessInterfaces.Repositories;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using NetTopologySuite.Features;
using NetTopologySuite.Geometries;
using OsmSharp;
using OsmSharp.Complete;
using OsmSharp.IO.API;
using OsmSharp.Tags;
using ProjNet.CoordinateSystems.Transformations;
using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Security.Cryptography;
using System.Text.RegularExpressions;
using System.Threading.Tasks;

namespace IsraelHiking.API.Services.Poi
{
    /// <summary>
    /// Points of interest adapter for OSM data
    /// </summary>
    public class OsmPointsOfInterestAdapter : IPointsOfInterestProvider
    {
        /// <summary>
        /// This icon is the default icon when no icon was used
        /// </summary>
        public const string SEARCH_ICON = "icon-search";

        private readonly IOsmGeoJsonPreprocessorExecutor _osmGeoJsonPreprocessorExecutor;
        private readonly IOsmRepository _osmRepository;
        private readonly IWikipediaGateway _wikipediaGateway;
        private readonly ITagsHelper _tagsHelper;
        private readonly IOsmLatestFileGateway _latestFileGateway;
        private readonly IElevationDataStorage _elevationDataStorage;
        private readonly IPointsOfInterestRepository _pointsOfInterestRepository;
        private readonly IDataContainerConverterService _dataContainerConverterService;
        private readonly IWikimediaCommonGateway _wikimediaCommonGateway;
        private readonly IBase64ImageStringToFileConverter _base64ImageConverter;
        private readonly IImagesUrlsStorageExecutor _imageUrlStoreExecutor;
        private readonly ILogger _logger;
        private readonly MathTransform _wgs84ItmMathTransform;
        private readonly ConfigurationData _options;

        /// <summary>
        /// Class constructor
        /// </summary>
        /// <param name="pointsOfInterestRepository"></param>
        /// <param name="elevationDataStorage"></param>
        /// <param name="osmGeoJsonPreprocessorExecutor"></param>
        /// <param name="osmRepository"></param>
        /// <param name="dataContainerConverterService"></param>
        /// <param name="wikipediaGateway"></param>
        /// <param name="itmWgs84MathTransfromFactory"></param>
        /// <param name="latestFileGateway"></param>
        /// <param name="base64ImageConverter"></param>
        /// <param name="wikimediaCommonGateway"></param>
        /// <param name="imageUrlStoreExecutor"></param>
        /// <param name="tagsHelper"></param>
        /// <param name="options"></param>
        /// <param name="logger"></param>
        public OsmPointsOfInterestAdapter(IPointsOfInterestRepository pointsOfInterestRepository,
            IElevationDataStorage elevationDataStorage,
            IOsmGeoJsonPreprocessorExecutor osmGeoJsonPreprocessorExecutor,
            IOsmRepository osmRepository,
            IDataContainerConverterService dataContainerConverterService,
            IWikipediaGateway wikipediaGateway,
            IItmWgs84MathTransfromFactory itmWgs84MathTransfromFactory,
            IOsmLatestFileGateway latestFileGateway,
            IWikimediaCommonGateway wikimediaCommonGateway,
            IBase64ImageStringToFileConverter base64ImageConverter,
            IImagesUrlsStorageExecutor imageUrlStoreExecutor,
            ITagsHelper tagsHelper,
            IOptions<ConfigurationData> options,
            ILogger logger)
        {
            _osmGeoJsonPreprocessorExecutor = osmGeoJsonPreprocessorExecutor;
            _osmRepository = osmRepository;
            _wikipediaGateway = wikipediaGateway;
            _tagsHelper = tagsHelper;
            _latestFileGateway = latestFileGateway;
            _elevationDataStorage = elevationDataStorage;
            _wgs84ItmMathTransform = itmWgs84MathTransfromFactory.CreateInverse();
            _options = options.Value;
            _pointsOfInterestRepository = pointsOfInterestRepository;
            _dataContainerConverterService = dataContainerConverterService;
            _wikimediaCommonGateway = wikimediaCommonGateway;
            _base64ImageConverter = base64ImageConverter;
            _imageUrlStoreExecutor = imageUrlStoreExecutor;
            _logger = logger;
        }

        /// <inheritdoc />
        public async Task<PointOfInterest[]> GetPointsOfInterest(Coordinate northEast, Coordinate southWest, string[] categories, string language)
        {
            var features = await _pointsOfInterestRepository.GetPointsOfInterest(northEast, southWest, categories, language);
            var points = features.Where(f => f.IsProperPoi(language)).Select(f => ConvertToPoiItem<PointOfInterest>(f, language)).ToArray();
            foreach (var pointOfInterest in points.Where(p => string.IsNullOrWhiteSpace(p.Icon)))
            {
                pointOfInterest.Icon = SEARCH_ICON;
            }
            return points;
        }

        /// <inheritdoc />
        public async Task<PointOfInterestExtended> GetPointOfInterestById(string source, string id, string language)
        {
            var feature = await _pointsOfInterestRepository.GetPointOfInterestById(id, source);
            if (feature == null)
            {
                return null;
            }
            return await FeatureToExtendedPoi(feature, language);
        }

        /// <summary>
        /// Adds extended data to point of interest object
        /// </summary>
        /// <param name="feature">The features to convert</param>
        /// <param name="language">the user interface language</param>
        /// <returns></returns>
        private async Task<PointOfInterestExtended> FeatureToExtendedPoi(Feature feature, string language)
        {
            var poiItem = ConvertToPoiItem<PointOfInterestExtended>(feature, language);
            await SetDataContainerAndLength(poiItem, feature);

            poiItem.References = GetReferences(feature, language);
            poiItem.ImagesUrls = feature.Attributes.GetNames()
                .Where(n => n.StartsWith(FeatureAttributes.IMAGE_URL))
                .Select(n => feature.Attributes[n].ToString())
                .Where(n => !string.IsNullOrWhiteSpace(n))
                .ToArray();
            poiItem.Description = feature.Attributes.GetByLanguage(FeatureAttributes.DESCRIPTION, language);
            poiItem.ExternalDescription = feature.Attributes.GetByLanguage(FeatureAttributes.POI_EXTERNAL_DESCRIPTION, language);
            poiItem.IsRoute = feature.Geometry is LineString || feature.Geometry is MultiLineString;
            poiItem.IsArea = feature.Geometry is Polygon || feature.Geometry is MultiPolygon;
            poiItem.IsEditable = feature.Attributes[FeatureAttributes.POI_SOURCE].Equals(Sources.OSM);
            poiItem.Contribution = GetContribution(feature);
            var (x, y) = _wgs84ItmMathTransform.Transform(poiItem.Location.Lng, poiItem.Location.Lat);
            poiItem.ItmCoordinates = new NorthEast { East = (int)x, North = (int)y };
            if (string.IsNullOrWhiteSpace(poiItem.Icon))
            {
                poiItem.Icon = SEARCH_ICON;
            }
            return poiItem;
        }

        private Contribution GetContribution(IFeature feature)
        {
            var contribution = new Contribution
            {
                LastModifiedDate = feature.GetLastModified()
            };
            var mainFeatureAttributes = feature.Attributes;
            if (mainFeatureAttributes.Exists(FeatureAttributes.POI_USER_NAME))
            {
                contribution.UserName = mainFeatureAttributes[FeatureAttributes.POI_USER_NAME].ToString();
            }
            if (mainFeatureAttributes.Exists(FeatureAttributes.POI_USER_ADDRESS))
            {
                contribution.UserAddress = mainFeatureAttributes[FeatureAttributes.POI_USER_ADDRESS].ToString();
            }
            return contribution;
        }

        private async Task SetDataContainerAndLength(PointOfInterestExtended poiItem, Feature feature)
        {
            ElevationSetterHelper.SetElevation(feature.Geometry, _elevationDataStorage);
            poiItem.FeatureCollection = new FeatureCollection { feature };
            poiItem.DataContainer = await _dataContainerConverterService.ToDataContainer(
                poiItem.FeatureCollection.ToBytes(), poiItem.Title + ".geojson");
            foreach (var coordinate in poiItem.DataContainer.Routes
                .SelectMany(r => r.Segments)
                .SelectMany(s => s.Latlngs)
                .Where(l => l.Alt == null || l.Alt.Value == 0))
            {
                coordinate.Alt = await _elevationDataStorage.GetElevation(coordinate.ToCoordinate());
            }

            foreach (var route in poiItem.DataContainer.Routes)
            {
                var itmRoute = route.Segments.SelectMany(s => s.Latlngs)
                    .Select(l => _wgs84ItmMathTransform.Transform(l.ToCoordinate().ToDoubleArray()))
                    .Select(c => c.ToCoordinate()).ToArray();
                var skip1 = itmRoute.Skip(1);
                poiItem.LengthInKm += itmRoute.Zip(skip1, (curr, prev) => curr.Distance(prev)).Sum() / 1000;
            }

        }

        /// <summary>
        /// Convers a feature to point of interest
        /// </summary>
        /// <typeparam name="TPoiItem">The point of interest object</typeparam>
        /// <param name="feature">The featue to convert</param>
        /// <param name="language">The user interface language</param>
        /// <returns></returns>
        private TPoiItem ConvertToPoiItem<TPoiItem>(IFeature feature, string language) where TPoiItem : PointOfInterest, new()
        {
            var poiItem = new TPoiItem();
            if (feature.Attributes[FeatureAttributes.POI_GEOLOCATION] is IAttributesTable)
            {
                Coordinate location = feature.GetLocation();
                poiItem.Location = new LatLng(location.Y, location.X, (double)feature.Attributes[FeatureAttributes.POI_ALT]);
            }
            poiItem.Category = feature.Attributes[FeatureAttributes.POI_CATEGORY].ToString();
            poiItem.Title = feature.Attributes.GetByLanguage(FeatureAttributes.NAME, language);
            poiItem.Id = feature.Attributes[FeatureAttributes.ID].ToString();
            poiItem.Source = feature.Attributes[FeatureAttributes.POI_SOURCE].ToString();
            poiItem.Icon = feature.Attributes[FeatureAttributes.POI_ICON].ToString();
            poiItem.IconColor = feature.Attributes[FeatureAttributes.POI_ICON_COLOR].ToString();
            poiItem.HasExtraData = feature.HasExtraData(language) || poiItem.Source != Sources.OSM;
            return poiItem;
        }

        /// <inheritdoc />
        public async Task<PointOfInterestExtended> AddPointOfInterest(PointOfInterestExtended pointOfInterest, IAuthClient osmGateway, string language)
        {
            var node = new Node
            {
                Latitude = pointOfInterest.Location.Lat,
                Longitude = pointOfInterest.Location.Lng,
                Tags = new TagsCollection()
            };
            SetWebsiteUrl(node.Tags, pointOfInterest.References.Select(r => r.Url).ToList());
            SetMultipleValuesForTag(node.Tags, FeatureAttributes.IMAGE_URL, pointOfInterest.ImagesUrls);
            SetTagByLanguage(node.Tags, FeatureAttributes.NAME, pointOfInterest.Title, language);
            SetTagByLanguage(node.Tags, FeatureAttributes.DESCRIPTION, pointOfInterest.Description, language);
            AddTagsByIcon(node.Tags, pointOfInterest.Icon);
            RemoveEmptyTags(node.Tags);
            var changesetId = await osmGateway.CreateChangeset($"Added {pointOfInterest.Title} using IsraelHiking.osm.org.il");
            node.Id = await osmGateway.CreateElement(changesetId, node);
            await osmGateway.CloseChangeset(changesetId);

            var feature = await UpdateElasticSearch(node);
            return await FeatureToExtendedPoi(feature, language);
        }

        /// <inheritdoc />
        public async Task<PointOfInterestExtended> UpdatePointOfInterest(PointOfInterestExtended pointOfInterest, IAuthClient osmGateway, string language)
        {
            var id = pointOfInterest.Id;
            ICompleteOsmGeo completeOsmGeo = await osmGateway.GetCompleteElement(GeoJsonExtensions.GetOsmId(id), GeoJsonExtensions.GetOsmType(id));
            var featureBeforeUpdate = ConvertOsmToFeature(completeOsmGeo);
            var oldIcon = featureBeforeUpdate.Attributes[FeatureAttributes.POI_ICON].ToString();
            var oldTags = completeOsmGeo.Tags.ToArray();

            SetWebsiteUrl(completeOsmGeo.Tags, pointOfInterest.References.Select(r => r.Url).ToList());
            SetTagByLanguage(completeOsmGeo.Tags, FeatureAttributes.NAME, pointOfInterest.Title, language);
            SetTagByLanguage(completeOsmGeo.Tags, FeatureAttributes.DESCRIPTION, pointOfInterest.Description, language);
            SyncImages(completeOsmGeo.Tags, pointOfInterest.ImagesUrls);
            if (pointOfInterest.Icon != oldIcon && pointOfInterest.Icon != SEARCH_ICON)
            {
                RemoveTagsByIcon(completeOsmGeo.Tags, oldIcon);
                AddTagsByIcon(completeOsmGeo.Tags, pointOfInterest.Icon);
            }
            RemoveEmptyTags(completeOsmGeo.Tags);
            var locationWasUpdated = UpdateLocationIfNeeded(completeOsmGeo, pointOfInterest.Location);
            if (Enumerable.SequenceEqual(oldTags, completeOsmGeo.Tags.ToArray()) && 
                !locationWasUpdated)
            {
                return pointOfInterest;
            }
            var changesetId = await osmGateway.CreateChangeset($"Updated {pointOfInterest.Title} using IsraelHiking.osm.org.il");
            await osmGateway.UpdateElement(changesetId, completeOsmGeo);
            await osmGateway.CloseChangeset(changesetId);

            var featureToReturn = await UpdateElasticSearch(completeOsmGeo);
            return await FeatureToExtendedPoi(featureToReturn, language);
        }

        /// <summary>
        /// Updates the location in case the OSM element is of type node and the location change is not too little
        /// </summary>
        /// <param name="completeOsmGeo">The element to update</param>
        /// <param name="location">The new location</param>
        /// <returns>True if the location was updated, false otherwise</returns>
        private bool UpdateLocationIfNeeded(ICompleteOsmGeo completeOsmGeo, LatLng location)
        {
            var node = completeOsmGeo as Node;
            if (node == null)
            {
                return false;
            }
            if (new Coordinate(node.Longitude.Value, node.Latitude.Value).Equals2D(location.ToCoordinate(), 0.00001))
            {
                return false;
            }
            node.Latitude = location.Lat;
            node.Longitude = location.Lng;
            return true;
        }

        /// <inheritdoc />
        public async Task<List<Feature>> GetAll()
        {
            _logger.LogInformation("Starting getting OSM points of interest");
            using var stream = await _latestFileGateway.Get();
            var osmEntities = await _osmRepository.GetElementsWithName(stream);
            var relevantTagsDictionary = _tagsHelper.GetAllTags();
            var namelessNodes = await _osmRepository.GetPointsWithNoNameByTags(stream, relevantTagsDictionary);
            osmEntities.AddRange(namelessNodes.Cast<ICompleteOsmGeo>().ToList());
            var features = _osmGeoJsonPreprocessorExecutor.Preprocess(osmEntities);
            _logger.LogInformation("Finished getting OSM points of interest: " + features.Count);
            return features;
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

        private Feature ConvertOsmToFeature(ICompleteOsmGeo osm)
        {
            var features = _osmGeoJsonPreprocessorExecutor.Preprocess(new List<ICompleteOsmGeo> {osm});
            return features.Any() ? features.First() : null;
        }

        private async Task<Feature> UpdateElasticSearch(ICompleteOsmGeo osm)
        {
            var feature = ConvertOsmToFeature(osm);
            if (feature == null)
            {
                return null;
            }
            var featureFromDb = await _pointsOfInterestRepository.GetPointOfInterestById(feature.Attributes[FeatureAttributes.ID].ToString(), Sources.OSM);
            if (featureFromDb != null)
            {
                foreach (var attributeKey in featureFromDb.Attributes.GetNames().Where(n => n.StartsWith(FeatureAttributes.POI_PREFIX)))
                {
                    if (!feature.Attributes.GetNames().Any(n => n == attributeKey)) {
                        feature.Attributes.AddOrUpdate(attributeKey, featureFromDb.Attributes[attributeKey]);
                    }
                }
                if (feature.Geometry.OgcGeometryType == OgcGeometryType.Point &&
                    featureFromDb.Geometry.OgcGeometryType != OgcGeometryType.Point)
                {
                    feature.Geometry = featureFromDb.Geometry;
                }
            }
            feature.SetLastModified(DateTime.Now);
            await _pointsOfInterestRepository.UpdatePointsOfInterestData(new List<Feature> { feature });
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
                tags.AddOrReplace(tagsList.First().Key, tagsList.First().Value);
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

        /// <inheritdoc />
        private Reference[] GetReferences(IFeature feature, string language)
        {
            var references = new List<Reference>();
            foreach (var websiteUrl in feature.Attributes.GetNames().Where(n => n.StartsWith(FeatureAttributes.WEBSITE)))
            {
                var url = feature.Attributes[websiteUrl].ToString();
                var indexString = websiteUrl.Substring(FeatureAttributes.WEBSITE.Length);
                var sourceImageUrl = string.Empty;
                if (feature.Attributes.Exists(FeatureAttributes.POI_SOURCE_IMAGE_URL + indexString))
                {
                    sourceImageUrl = feature.Attributes[FeatureAttributes.POI_SOURCE_IMAGE_URL + indexString].ToString();
                }
                else if (feature.Attributes.Exists(FeatureAttributes.POI_SOURCE_IMAGE_URL))
                {
                    sourceImageUrl = feature.Attributes[FeatureAttributes.POI_SOURCE_IMAGE_URL].ToString();
                }
                references.Add(new Reference
                {
                    Url = url,
                    SourceImageUrl = sourceImageUrl
                });
            }
            // HM TODO: is this needed after the merge is taking into account wikipedia too?
            var title = feature.Attributes.GetWikipediaTitle(language);
            if (!string.IsNullOrWhiteSpace(title))
            {
                var wikipediaReference = _wikipediaGateway.GetReference(title, language);    
                references.Add(wikipediaReference);
            }
            // unique by url
            return references.GroupBy(r => r.Url)
                        .Select(r => r.FirstOrDefault())
                        .ToArray();
        }

        private void SetWebsiteUrl(TagsCollectionBase tags, List<string> urls)
        {
            var regexp = new Regex(@"((https?://)|^)([a-z]+)(\.m)?\.wikipedia.org/wiki/(.*)");
            var nonWikipediaUrls = new List<string>();
            foreach (var url in urls)
            {
                var match = regexp.Match(url ?? string.Empty);
                if (!match.Success)
                {
                    nonWikipediaUrls.Add(url);
                    continue;
                }
                var language = match.Groups[3].Value;
                var pageTitle = Uri.UnescapeDataString(match.Groups[5].Value.Replace("_", " "));
                var key = FeatureAttributes.WIKIPEDIA + ":" + language;
                tags.AddOrReplace(key, pageTitle);
                key = FeatureAttributes.WIKIPEDIA;
                pageTitle = language + ":" + pageTitle;
                if (tags.ContainsKey(key) == false)
                {
                    tags.Add(key, pageTitle);
                }
            }
            SetMultipleValuesForTag(tags, FeatureAttributes.WEBSITE, nonWikipediaUrls.ToArray());
        }

        private void SetMultipleValuesForTag(TagsCollectionBase tags, string tagKey, string[] values)
        {
            foreach (var tag in tags.Where(t => t.Key.StartsWith(tagKey)))
            {
                tags.RemoveKey(tag.Key);
            }
            for (var index = 0; index < values.Length; index++)
            {
                var value = values[index];
                var tagName = index == 0 ? tagKey : tagKey + index;
                tags.AddOrReplace(tagName, value);
            }
        }

        /// <inheritdoc/>
        public async Task<Feature> GetClosestPoint(Coordinate location, string source, string language = "")
        {
            var distance = _options.ClosestPointsOfInterestThreshold;
            var results = await _pointsOfInterestRepository.GetPointsOfInterest(
                new Coordinate(location.X + distance, location.Y + distance),
                new Coordinate(location.X - distance, location.Y - distance),
                Categories.Points, 
                string.IsNullOrEmpty(language) ? Languages.ALL : language);
            return results.Where(r => r.Geometry is Point && ((source != null && r.Attributes[FeatureAttributes.POI_SOURCE].Equals(source)) || source == null))
                .OrderBy(f => f.Geometry.Coordinate.Distance(location))
                .FirstOrDefault();
        }

        /// <inheritdoc/>
        public async Task<UpdatesResponse> GetUpdates(DateTime lastMoidifiedDate, DateTime modifiedUntil)
        {
            var results = (lastMoidifiedDate == DateTime.MinValue)
                ? await _pointsOfInterestRepository.GetAllPointsOfInterest(false)
                : await _pointsOfInterestRepository.GetPointsOfInterestUpdates(lastMoidifiedDate, modifiedUntil);
            var lastModified = await _pointsOfInterestRepository.GetLastSuccessfulRebuildTime();
            return new UpdatesResponse
            {
                Features = results.ToArray(),
                LastModified = lastModified
            };
            
        }

        /// <inheritdoc/>
        public Task<Feature> GetFeatureById(string source, string id)
        {
            return _pointsOfInterestRepository.GetPointOfInterestById(id, source);
        }

        /// <inheritdoc/>
        public async Task<Feature[]> GetFeatures(Coordinate northEast, Coordinate southWest, string[] categories, string language)
        {
            var features = await _pointsOfInterestRepository.GetPointsOfInterest(northEast, southWest, categories, language);
            var points = features.Where(f => f.IsProperPoi(language)).ToArray();
            foreach (var pointOfInterest in points.Where(p => string.IsNullOrWhiteSpace(p.Attributes[FeatureAttributes.POI_ICON]?.ToString())))
            {
                pointOfInterest.Attributes.AddOrUpdate(FeatureAttributes.POI_ICON, SEARCH_ICON);
            }
            foreach (var feature in features)
            {
                var location = feature.GetLocation();
                feature.Geometry = new Point(location);
            }
            return points;
        }

        /// <inheritdoc/>
        public async Task<Feature> AddFeature(Feature feature, IAuthClient osmGateway, string language)
        {
            var icon = feature.Attributes[FeatureAttributes.POI_ICON].ToString();
            var location = feature.GetLocation();
            var idString = feature.Attributes.Exists(FeatureAttributes.POI_ID) ? feature.GetId() : "";
            _logger.LogInformation($"Uploaded a POI of type {icon} with id: {idString}, at {location.Y}, {location.X}");
            var imagesList = await UploadImages(feature, language, osmGateway);
            var node = new Node
            {
                Latitude = location.Y,
                Longitude = location.X,
                Tags = new TagsCollection()
            };
            SetWebsiteUrl(node.Tags, feature.Attributes.GetNames()
                    .Where(n => n.StartsWith(FeatureAttributes.WEBSITE))
                    .Select(p => feature.Attributes[p].ToString())
                    .ToList());
            SetMultipleValuesForTag(node.Tags, FeatureAttributes.IMAGE_URL, imagesList);
            SetTagByLanguage(node.Tags, FeatureAttributes.NAME, feature.GetTitle(language), language);
            SetTagByLanguage(node.Tags, FeatureAttributes.DESCRIPTION, feature.GetDescription(language), language);
            AddTagsByIcon(node.Tags, feature.Attributes[FeatureAttributes.POI_ICON].ToString());
            RemoveEmptyTags(node.Tags);
            var changesetId = await osmGateway.CreateChangeset($"Added {feature.GetTitle(language)} using IsraelHiking.osm.org.il");
            node.Id = await osmGateway.CreateElement(changesetId, node);
            await osmGateway.CloseChangeset(changesetId);

            return await UpdateElasticSearch(node);
        }

        /// <inheritdoc/>
        public async Task<Feature> UpdateFeature(Feature partialFeature, IAuthClient osmGateway, string language)
        {
            ICompleteOsmGeo completeOsmGeo = await osmGateway.GetCompleteElement(partialFeature.GetOsmId(), partialFeature.GetOsmType());
            var featureBeforeUpdate = await _pointsOfInterestRepository.GetPointOfInterestById(partialFeature.Attributes[FeatureAttributes.ID].ToString(), Sources.OSM);
            var oldIcon = featureBeforeUpdate.Attributes[FeatureAttributes.POI_ICON].ToString();
            var oldTags = completeOsmGeo.Tags.ToArray();
            var locationWasUpdated = false;
            partialFeature.SetTitles();
            if (!string.IsNullOrWhiteSpace(partialFeature.GetTitle(language)))
            {
                SetTagByLanguage(completeOsmGeo.Tags, FeatureAttributes.NAME, partialFeature.GetTitle(language), language);
            }
            if (!string.IsNullOrWhiteSpace(partialFeature.GetDescription(language)))
            {
                SetTagByLanguage(completeOsmGeo.Tags, FeatureAttributes.DESCRIPTION, partialFeature.GetDescription(language), language);
            }
            if (partialFeature.Attributes.Exists(FeatureAttributes.POI_ICON))
            {
                var icon = partialFeature.Attributes[FeatureAttributes.POI_ICON].ToString();
                if (icon != oldIcon && icon != SEARCH_ICON)
                {
                    RemoveTagsByIcon(completeOsmGeo.Tags, oldIcon);
                    AddTagsByIcon(completeOsmGeo.Tags, icon);
                }
            }
            if (partialFeature.Attributes.Exists(FeatureAttributes.POI_GEOLOCATION))
            {
                var coordinate = partialFeature.GetLocation();
                var location = new LatLng(coordinate.Y, coordinate.X);
                locationWasUpdated = UpdateLocationIfNeeded(completeOsmGeo, location);
            }

            await UpdateLists(partialFeature, completeOsmGeo, osmGateway, language);

            RemoveEmptyTags(completeOsmGeo.Tags);
            if (Enumerable.SequenceEqual(oldTags, completeOsmGeo.Tags.ToArray()) &&
                !locationWasUpdated)
            {
                return featureBeforeUpdate;
            }
            var changesetId = await osmGateway.CreateChangeset($"Updated {featureBeforeUpdate.GetTitle(language)} using IsraelHiking.osm.org.il");
            await osmGateway.UpdateElement(changesetId, completeOsmGeo);
            await osmGateway.CloseChangeset(changesetId);

            return await UpdateElasticSearch(completeOsmGeo);
        }

        /// <summary>
        /// This function updates the lists of items in the OSM entity, i.e. websites and images.
        /// In case there are "holes" the function reorders the list to remove holes such as image=..., image2=...
        /// </summary>
        /// <param name="partialFeature">A feature containing only deltas</param>
        /// <param name="completeOsmGeo">The OSM entity to update</param>
        /// <param name="osmGateway">The gateway to get the user details from</param>
        /// <param name="language">The language to use for the tags</param>
        /// <returns></returns>
        private async Task UpdateLists(Feature partialFeature, ICompleteOsmGeo completeOsmGeo, IAuthClient osmGateway, string language)
        {
            var featureAfterTagsUpdates = ConvertOsmToFeature(completeOsmGeo);
            var existingUrls = featureAfterTagsUpdates.Attributes.GetNames()
                     .Where(n => n.StartsWith(FeatureAttributes.WEBSITE))
                     .Select(p => featureAfterTagsUpdates.Attributes[p].ToString())
                     .ToList();
            if (partialFeature.Attributes.Exists(FeatureAttributes.POI_ADDED_URLS))
            {    
                var user = await osmGateway.GetUserDetails();
                foreach (var url in partialFeature.Attributes[FeatureAttributes.POI_ADDED_URLS] as IEnumerable<object>)
                {
                    existingUrls.Add(url.ToString());
                }
            }
            if (partialFeature.Attributes.Exists(FeatureAttributes.POI_REMOVED_URLS))
            {
                foreach(var urlToRemove in partialFeature.Attributes[FeatureAttributes.POI_REMOVED_URLS] as IEnumerable<object>)
                {
                    existingUrls.Remove(urlToRemove.ToString());
                }
            }
            SetWebsiteUrl(completeOsmGeo.Tags, existingUrls);

            var existingImages = featureAfterTagsUpdates.Attributes.GetNames()
                    .Where(n => n.StartsWith(FeatureAttributes.IMAGE_URL))
                    .Select(p => featureAfterTagsUpdates.Attributes[p].ToString())
                    .ToList();
            if (partialFeature.Attributes.Exists(FeatureAttributes.POI_ADDED_IMAGES))
            {
                var user = await osmGateway.GetUserDetails();
                foreach (var imageUrl in partialFeature.Attributes[FeatureAttributes.POI_ADDED_IMAGES] as IEnumerable<object>)
                {
                    existingImages.Add(await UploadImageIfNeeded(imageUrl.ToString(), featureAfterTagsUpdates, language, user.DisplayName));
                }
            }
            if (partialFeature.Attributes.Exists(FeatureAttributes.POI_REMOVED_IMAGES))
            {
                foreach (var imageUrlToRemove in partialFeature.Attributes[FeatureAttributes.POI_REMOVED_IMAGES] as IEnumerable<object>)
                {
                    existingImages.Remove(imageUrlToRemove.ToString());
                }
            }
            SetMultipleValuesForTag(completeOsmGeo.Tags, FeatureAttributes.IMAGE_URL, existingImages.ToArray());
        }

        private async Task<string[]> UploadImages(Feature feature, string language, IAuthClient osmGateway)
        {
            var user = await osmGateway.GetUserDetails();
            feature.SetTitles();
            var imageUrls = feature.Attributes.GetNames()
                    .Where(n => n.StartsWith(FeatureAttributes.IMAGE_URL))
                    .Select(p => feature.Attributes[p].ToString())
                    .ToArray();
            var updatedImageUrls = new List<string>();
            foreach (var imageUrl in imageUrls)
            {
                updatedImageUrls.Add(await UploadImageIfNeeded(imageUrl, feature, language, user.DisplayName));
            }
            return updatedImageUrls.ToArray();
        }

        private async Task<string> UploadImageIfNeeded(string imageUrl,
            Feature feature, string language, string userDisplayName)
        {
            var icon = feature.Attributes[FeatureAttributes.POI_ICON].ToString();
            var fileName = string.IsNullOrWhiteSpace(feature.GetTitle(language))
                    ? icon.Replace("icon-", "")
                    : feature.GetTitle(language);
            var file = _base64ImageConverter.ConvertToFile(imageUrl, fileName);
            if (file == null)
            {
                return imageUrl;
            }
            using var md5 = MD5.Create();
            var imageUrlFromDatabase = await _imageUrlStoreExecutor.GetImageUrlIfExists(md5, file.Content);
            if (imageUrlFromDatabase != null)
            {
                return imageUrlFromDatabase;
            }
            using var memoryStream = new MemoryStream(file.Content);
            var imageName = await _wikimediaCommonGateway.UploadImage(feature.GetTitle(language),
                    feature.GetDescription(language), userDisplayName, file.FileName, memoryStream, feature.GetLocation());
            imageUrl = await _wikimediaCommonGateway.GetImageUrl(imageName);
            await _imageUrlStoreExecutor.StoreImage(md5, file.Content, imageUrl);
            return imageUrl;
        }
    }
}
