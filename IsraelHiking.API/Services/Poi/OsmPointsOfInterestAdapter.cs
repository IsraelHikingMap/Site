using IsraelHiking.API.Executors;
using IsraelHiking.API.Gpx;
using IsraelHiking.API.Services.Osm;
using IsraelHiking.Common;
using IsraelHiking.Common.Extensions;
using IsraelHiking.Common.Poi;
using IsraelHiking.DataAccessInterfaces;
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
using System.Collections.ObjectModel;
using System.Linq;
using System.Text.RegularExpressions;
using System.Threading.Tasks;

namespace IsraelHiking.API.Services.Poi
{
    /// <summary>
    /// Points of interest adapter for OSM data
    /// </summary>
    public class OsmPointsOfInterestAdapter : BasePointsOfInterestAdapter, IPointsOfInterestProvider
    {
        /// <summary>
        /// This icon is the default icon when no icon was used
        /// </summary>
        public const string SEARCH_ICON = "icon-search";

        private readonly IClientsFactory _clientsFactory;
        private readonly IOsmGeoJsonPreprocessorExecutor _osmGeoJsonPreprocessorExecutor;
        private readonly IOsmRepository _osmRepository;
        private readonly IWikipediaGateway _wikipediaGateway;
        private readonly ITagsHelper _tagsHelper;
        private readonly IOsmLatestFileFetcherExecutor _latestFileFetcherExecutor;
        private readonly IElevationDataStorage _elevationDataStorage;
        private readonly IElasticSearchGateway _elasticSearchGateway;
        private readonly MathTransform _wgs84ItmMathTransform;
        private readonly ConfigurationData _options;

        /// <summary>
        /// Class constructor
        /// </summary>
        /// <param name="elasticSearchGateway"></param>
        /// <param name="elevationDataStorage"></param>
        /// <param name="clentsFactory"></param>
        /// <param name="osmGeoJsonPreprocessorExecutor"></param>
        /// <param name="osmRepository"></param>
        /// <param name="dataContainerConverterService"></param>
        /// <param name="wikipediaGateway"></param>
        /// <param name="itmWgs84MathTransfromFactory"></param>
        /// <param name="latestFileFetcherExecutor"></param>
        /// <param name="tagsHelper"></param>
        /// <param name="options"></param>
        /// <param name="logger"></param>
        public OsmPointsOfInterestAdapter(IElasticSearchGateway elasticSearchGateway,
            IElevationDataStorage elevationDataStorage,
            IClientsFactory clentsFactory,
            IOsmGeoJsonPreprocessorExecutor osmGeoJsonPreprocessorExecutor,
            IOsmRepository osmRepository,
            IDataContainerConverterService dataContainerConverterService,
            IWikipediaGateway wikipediaGateway,
            IItmWgs84MathTransfromFactory itmWgs84MathTransfromFactory,
            IOsmLatestFileFetcherExecutor latestFileFetcherExecutor,
            ITagsHelper tagsHelper,
            IOptions<ConfigurationData> options,
            ILogger logger) :
            base(dataContainerConverterService,
                logger)
        {
            _clientsFactory = clentsFactory;
            _osmGeoJsonPreprocessorExecutor = osmGeoJsonPreprocessorExecutor;
            _osmRepository = osmRepository;
            _wikipediaGateway = wikipediaGateway;
            _tagsHelper = tagsHelper;
            _latestFileFetcherExecutor = latestFileFetcherExecutor;
            _elevationDataStorage = elevationDataStorage;
            _wgs84ItmMathTransform = itmWgs84MathTransfromFactory.CreateInverse();
            _options = options.Value;
            _elasticSearchGateway = elasticSearchGateway;
        }

        /// <inheritdoc />
        public override string Source => Sources.OSM;

        /// <inheritdoc />
        public async Task<PointOfInterest[]> GetPointsOfInterest(Coordinate northEast, Coordinate southWest, string[] categories, string language)
        {
            var features = await _elasticSearchGateway.GetPointsOfInterest(northEast, southWest, categories, language);
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
            var feature = await _elasticSearchGateway.GetPointOfInterestById(id, source);
            if (feature == null)
            {
                return null;
            }
            var poiItem = await FeatureToExtendedPoi(feature, language);
            poiItem.IsRoute = feature.Geometry is LineString || feature.Geometry is MultiLineString;
            poiItem.IsArea = feature.Geometry is Polygon || feature.Geometry is MultiPolygon;
            poiItem.IsEditable = feature.Attributes[FeatureAttributes.POI_SOURCE].Equals(Sources.OSM);
            return poiItem;
        }

        /// <summary>
        /// Adds extended data to point of interest object
        /// </summary>
        /// <param name="feature">The features to convert</param>
        /// <param name="language">the user interface language</param>
        /// <returns></returns>
        private async Task<PointOfInterestExtended> ConvertToPoiExtended(Feature feature, string language)
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
            poiItem.IsEditable = false;
            poiItem.Contribution = GetContribution(feature.Attributes);
            var itmCoordinate = _wgs84ItmMathTransform.Transform(poiItem.Location.Lng, poiItem.Location.Lat);
            poiItem.ItmCoordinates = new NorthEast { East = (int)itmCoordinate.x, North = (int)itmCoordinate.y };
            return poiItem;
        }

        private Contribution GetContribution(IAttributesTable mainFeatureAttributes)
        {
            var contribution = new Contribution();
            if (mainFeatureAttributes.Exists(FeatureAttributes.POI_USER_NAME))
            {
                contribution.UserName = mainFeatureAttributes[FeatureAttributes.POI_USER_NAME].ToString();
            }
            if (mainFeatureAttributes.Exists(FeatureAttributes.POI_LAST_MODIFIED))
            {
                contribution.LastModifiedDate = DateTime.Parse(mainFeatureAttributes[FeatureAttributes.POI_LAST_MODIFIED].ToString());
            }
            if (mainFeatureAttributes.Exists(FeatureAttributes.POI_USER_ADDRESS))
            {
                contribution.UserAddress = mainFeatureAttributes[FeatureAttributes.POI_USER_ADDRESS].ToString();
            }
            return contribution;
        }

        private async Task SetDataContainerAndLength(PointOfInterestExtended poiItem, Feature feature)
        {
            foreach (var coordinate in feature.Geometry.Coordinates)
            {
                coordinate.Z = await _elevationDataStorage.GetElevation(coordinate);
            }
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
            if (feature.Attributes[FeatureAttributes.POI_GEOLOCATION] is AttributesTable geoLocation)
            {
                poiItem.Location = new LatLng((double)geoLocation[FeatureAttributes.LAT], 
                    (double)geoLocation[FeatureAttributes.LON],
                    (double)feature.Attributes[FeatureAttributes.POI_ALT]);
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

        private async Task<PointOfInterestExtended> FeatureToExtendedPoi(Feature feature, string language)
        {
            var poiItem = await ConvertToPoiExtended(feature, language);
            if (string.IsNullOrWhiteSpace(poiItem.Icon))
            {
                poiItem.Icon = SEARCH_ICON;
            }
            return poiItem;
        }

        /// <inheritdoc />
        public async Task<PointOfInterestExtended> AddPointOfInterest(PointOfInterestExtended pointOfInterest, TokenAndSecret tokenAndSecret, string language)
        {
            var osmGateway = CreateOsmGateway(tokenAndSecret);
            var changesetId = await osmGateway.CreateChangeset($"Added {pointOfInterest.Title} using IsraelHiking.osm.org.il");
            var node = new Node
            {
                Latitude = pointOfInterest.Location.Lat,
                Longitude = pointOfInterest.Location.Lng,
                Tags = new TagsCollection()
            };
            SetWebsiteUrl(node.Tags, pointOfInterest);
            SetMultipleValuesForTag(node.Tags, FeatureAttributes.IMAGE_URL, pointOfInterest.ImagesUrls);
            SetTagByLanguage(node.Tags, FeatureAttributes.NAME, pointOfInterest.Title, language);
            SetTagByLanguage(node.Tags, FeatureAttributes.DESCRIPTION, pointOfInterest.Description, language);
            AddTagsByIcon(node.Tags, pointOfInterest.Icon);
            RemoveEmptyTags(node.Tags);
            node.Id = await osmGateway.CreateElement(changesetId, node);
            await osmGateway.CloseChangeset(changesetId);

            var feature = await UpdateElasticSearch(node, pointOfInterest.Title);
            return await FeatureToExtendedPoi(feature, language);
        }

        /// <inheritdoc />
        public async Task<PointOfInterestExtended> UpdatePointOfInterest(PointOfInterestExtended pointOfInterest, TokenAndSecret tokenAndSecret, string language)
        {
            var osmGateway = CreateOsmGateway(tokenAndSecret);
            var id = pointOfInterest.Id;
            ICompleteOsmGeo completeOsmGeo = await osmGateway.GetCompleteElement(GeoJsonExtensions.GetOsmId(id), GeoJsonExtensions.GetOsmType(id));
            var featureBeforeUpdate = ConvertOsmToFeature(completeOsmGeo, pointOfInterest.Title);
            var oldIcon = featureBeforeUpdate.Attributes[FeatureAttributes.POI_ICON].ToString();
            var oldTags = completeOsmGeo.Tags.ToArray();

            SetWebsiteUrl(completeOsmGeo.Tags, pointOfInterest);
            SetTagByLanguage(completeOsmGeo.Tags, FeatureAttributes.NAME, pointOfInterest.Title, language);
            SetTagByLanguage(completeOsmGeo.Tags, FeatureAttributes.DESCRIPTION, pointOfInterest.Description, language);
            SyncImages(completeOsmGeo.Tags, pointOfInterest.ImagesUrls);
            if (pointOfInterest.Icon != oldIcon && pointOfInterest.Icon != SEARCH_ICON)
            {
                RemoveTagsByIcon(completeOsmGeo.Tags, oldIcon);
                AddTagsByIcon(completeOsmGeo.Tags, pointOfInterest.Icon);
            }
            RemoveEmptyTags(completeOsmGeo.Tags);
            if (AreTagsCollectionEqual(oldTags, completeOsmGeo.Tags.ToArray()))
            {
                return pointOfInterest;
            }

            var changesetId = await osmGateway.CreateChangeset($"Updated {pointOfInterest.Title} using IsraelHiking.osm.org.il");
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
        public override async Task<List<Feature>> GetPointsForIndexing()
        {
            _logger.LogInformation("Starting getting OSM points of interest");
            using (var stream = _latestFileFetcherExecutor.Get())
            {
                var osmNamesDictionary = await _osmRepository.GetElementsWithName(stream);
                var relevantTagsDictionary = _tagsHelper.GetAllTags();
                var namelessNodes = await _osmRepository.GetPointsWithNoNameByTags(stream, relevantTagsDictionary);
                osmNamesDictionary.Add(string.Empty, namelessNodes.Cast<ICompleteOsmGeo>().ToList());
                var features = _osmGeoJsonPreprocessorExecutor.Preprocess(osmNamesDictionary);
                _logger.LogInformation("Finished getting OSM points of interest: " + features.Count);
                return features;
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
            return features.Any() ? features.First() : null;
        }

        private async Task<Feature> UpdateElasticSearch(ICompleteOsmGeo osm, string name)
        {
            var feature = ConvertOsmToFeature(osm, name);
            if (feature == null)
            {
                return null;
            }
            var featureFromDb = await _elasticSearchGateway.GetPointOfInterestById(feature.Attributes[FeatureAttributes.ID].ToString(), Sources.OSM);
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

            await _elasticSearchGateway.UpdatePointsOfInterestData(new List<Feature> { feature });
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
                await _elasticSearchGateway.DeletePointOfInterestById(pageFetaure.Attributes[FeatureAttributes.ID].ToString(), Sources.WIKIPEDIA);
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

        private void SetWebsiteUrl(TagsCollectionBase tags, PointOfInterestExtended pointOfInterest)
        {
            var regexp = new Regex("((https?://)|^)([a-z]+).wikipedia.org/wiki/(.*)");
            var nonWikipediaUrls = new List<string>();
            foreach (var url in pointOfInterest.References.Select(r => r.Url))
            {
                var match = regexp.Match(url ?? string.Empty);
                if (!match.Success)
                {
                    nonWikipediaUrls.Add(url);
                    continue;
                }
                var language = match.Groups[3].Value;
                var pageTitle = Uri.UnescapeDataString(match.Groups[4].Value.Replace("_", " "));
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
            for (var index = 0; index < values.Length; index++)
            {
                var value = values[index];
                var tagName = index == 0 ? tagKey : tagKey + index;
                tags.AddOrReplace(tagName, value);
            }
        }

        private IAuthClient CreateOsmGateway(TokenAndSecret tokenAndSecret)
        {
            return _clientsFactory.CreateOAuthClient(_options.OsmConfiguration.ConsumerKey, 
                _options.OsmConfiguration.ConsumerSecret, 
                tokenAndSecret.Token, 
                tokenAndSecret.TokenSecret);
        }

        /// <inheritdoc />
        public override Task<Feature> GetRawPointOfInterestById(string id)
        {
            // This should not return anything
            throw new NotImplementedException();
        }

        /// <inheritdoc/>
        public async Task<Feature> GetClosestPoint(Coordinate location, string source, string language = "")
        {
            var distance = _options.MergePointsOfInterestThreshold;
            var results = await _elasticSearchGateway.GetPointsOfInterest(
                new Coordinate(location.X + distance, location.Y + distance),
                new Coordinate(location.X - distance, location.Y - distance),
                Categories.Points.Concat(new[] { Categories.NONE }).ToArray(), 
                string.IsNullOrEmpty(language) ? Languages.ALL : language);
            return results.Where(r => r.Geometry is Point && ((source != null && r.Attributes[FeatureAttributes.POI_SOURCE].Equals(source)) || source == null))
                .OrderBy(f => f.Geometry.Coordinate.Distance(location))
                .FirstOrDefault();
        }
    }
}
