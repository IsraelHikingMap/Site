using IsraelHiking.API.Executors;
using IsraelHiking.API.Gpx;
using IsraelHiking.Common;
using IsraelHiking.Common.Extensions;
using IsraelHiking.Common.Poi;
using IsraelHiking.DataAccessInterfaces;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using NetTopologySuite.Features;
using NetTopologySuite.Geometries;
using ProjNet.CoordinateSystems.Transformations;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;

namespace IsraelHiking.API.Services.Poi
{
    /// <inheritdoc />
    /// <summary>
    /// Base class for points of interest adapter
    /// </summary>
    public abstract class BasePointsOfInterestAdapter : IPointsOfInterestAdapter
    {
        /// <summary>
        /// Elasticsearch gateway to be used in derived classes
        /// </summary>
        protected readonly IElasticSearchGateway _elasticSearchGateway;
        /// <summary>
        /// Logger
        /// </summary>
        protected readonly ILogger _logger;
        /// <summary>
        /// Data container service used to convert the data
        /// </summary>
        protected readonly IDataContainerConverterService _dataContainerConverterService;
        /// <summary>
        /// Global configuration data
        /// </summary>
        protected readonly ConfigurationData _options;

        private readonly IElevationDataStorage _elevationDataStorage;
        
        private readonly MathTransform _wgs84ItmMathTransform;

        

        /// <inheritdoc />
        public abstract string Source { get; }
        /// <inheritdoc />
        public abstract Task<PointOfInterestExtended> GetPointOfInterestById(string id, string language);
        /// <inheritdoc />
        public abstract Task<List<Feature>> GetPointsForIndexing();

        /// <summary>
        /// Adapter's constructor
        /// </summary>
        /// <param name="elevationDataStorage"></param>
        /// <param name="elasticSearchGateway"></param>
        /// <param name="dataContainerConverterService"></param>
        /// <param name="itmWgs84MathTransfromFactory"></param>
        /// <param name="options"></param>
        /// <param name="logger"></param>
        protected BasePointsOfInterestAdapter(IElevationDataStorage elevationDataStorage, 
            IElasticSearchGateway elasticSearchGateway, 
            IDataContainerConverterService dataContainerConverterService,
            IItmWgs84MathTransfromFactory itmWgs84MathTransfromFactory,
            IOptions<ConfigurationData> options,
            ILogger logger)
        {
            _elevationDataStorage = elevationDataStorage;
            _elasticSearchGateway = elasticSearchGateway;
            _dataContainerConverterService = dataContainerConverterService;
            _wgs84ItmMathTransform = itmWgs84MathTransfromFactory.CreateInverse();
            _options = options.Value;
            _logger = logger;
        }

        /// <summary>
        /// Convers a feature to point of interest
        /// </summary>
        /// <typeparam name="TPoiItem">The point of interest object</typeparam>
        /// <param name="feature">The featue to convert</param>
        /// <param name="language">The user interface language</param>
        /// <returns></returns>
        protected async Task<TPoiItem> ConvertToPoiItem<TPoiItem>(IFeature feature, string language) where TPoiItem : PointOfInterest, new()
        {
            var poiItem = new TPoiItem();
            if (feature.Attributes[FeatureAttributes.GEOLOCATION] is AttributesTable geoLocation)
            {
                poiItem.Location = new LatLng((double)geoLocation[FeatureAttributes.LAT], (double)geoLocation[FeatureAttributes.LON]);
                var alt = await _elevationDataStorage.GetElevation(new Coordinate().FromLatLng(poiItem.Location));
                poiItem.Location.Alt = alt;
            }
            poiItem.Category = feature.Attributes[FeatureAttributes.POI_CATEGORY].ToString();
            poiItem.Title = feature.Attributes.GetByLanguage(FeatureAttributes.NAME, language);
            poiItem.Id = feature.Attributes[FeatureAttributes.ID].ToString();
            poiItem.Source = feature.Attributes[FeatureAttributes.POI_SOURCE].ToString();
            poiItem.Icon = feature.Attributes[FeatureAttributes.ICON].ToString();
            poiItem.IconColor = feature.Attributes[FeatureAttributes.ICON_COLOR].ToString();
            poiItem.HasExtraData = feature.HasExtraData(language) || poiItem.Source != Sources.OSM;
            return poiItem;
        }

        /// <summary>
        /// Adds extended data to point of interest object
        /// </summary>
        /// <param name="featureCollection">The features to convert</param>
        /// <param name="language">the user interface language</param>
        /// <returns></returns>
        protected async Task<PointOfInterestExtended> ConvertToPoiExtended(FeatureCollection featureCollection, string language)
        {
            var mainFeature = featureCollection.Count == 1
                ? featureCollection.First()
                : featureCollection.First(f => f.Geometry is LineString);
            var poiItem = await ConvertToPoiItem<PointOfInterestExtended>(mainFeature, language);
            await SetDataContainerAndLength(poiItem, featureCollection);

            poiItem.References = GetReferences(mainFeature, language);
            poiItem.ImagesUrls = mainFeature.Attributes.GetNames()
                .Where(n => n.StartsWith(FeatureAttributes.IMAGE_URL))
                .Select(n => mainFeature.Attributes[n].ToString())
                .Where(n => !string.IsNullOrWhiteSpace(n))
                .ToArray();
            poiItem.Description = mainFeature.Attributes.GetByLanguage(FeatureAttributes.DESCRIPTION, language);
            poiItem.Rating = await _elasticSearchGateway.GetRating(poiItem.Id, poiItem.Source);
            poiItem.IsEditable = false;
            poiItem.Contribution = GetContribution(mainFeature.Attributes);
            var featureFromDatabase = await _elasticSearchGateway.GetPointOfInterestById(mainFeature.Attributes[FeatureAttributes.ID].ToString(), Source);
            if (featureFromDatabase != null)
            {
                poiItem.CombinedIds = featureFromDatabase.GetIdsFromCombinedPoi();
            }
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

        private async Task SetDataContainerAndLength(PointOfInterestExtended poiItem, FeatureCollection featureCollection)
        {
            foreach (var coordinate in featureCollection.SelectMany(f => f.Geometry.Coordinates))
            {
                coordinate.Z = await _elevationDataStorage.GetElevation(coordinate);
            }
            poiItem.FeatureCollection = featureCollection;
            poiItem.DataContainer = await _dataContainerConverterService.ToDataContainer(
                featureCollection.ToBytes(), poiItem.Title + ".geojson");
            foreach (var coordinate in poiItem.DataContainer.Routes
                .SelectMany(r => r.Segments)
                .SelectMany(s => s.Latlngs)
                .Where(l => l.Alt == null || l.Alt.Value == 0))
            {
                coordinate.Alt = await _elevationDataStorage.GetElevation(new Coordinate().FromLatLng(coordinate));
            }

            foreach (var route in poiItem.DataContainer.Routes)
            {
                var itmRoute = route.Segments.SelectMany(s => s.Latlngs)
                    .Select(l => _wgs84ItmMathTransform.Transform(new Coordinate().FromLatLng(l).ToDoubleArray()))
                    .Select(c => new Coordinate().FromDoubleArray(c)).ToArray();
                var skip1 = itmRoute.Skip(1);
                poiItem.LengthInKm += itmRoute.Zip(skip1, (curr, prev) => curr.Distance(prev)).Sum() / 1000;
            }
            
        }

        /// <summary>
        /// This function is used to get the website Urls from the feature
        /// </summary>
        /// <param name="feature"></param>
        /// <param name="language"></param>
        /// <returns>A list of references including reference logo</returns>
        protected virtual Reference[] GetReferences(IFeature feature, string language)
        {
            var references = new List<Reference>();
            foreach (var websiteUrl in feature.Attributes.GetNames().Where(n => n.StartsWith(FeatureAttributes.WEBSITE)))
            {
                var url = feature.Attributes[websiteUrl].ToString();
                var indexString = websiteUrl.Substring(FeatureAttributes.WEBSITE.Length);
                var sourceImageUrl = string.Empty;
                if (feature.Attributes.Exists(FeatureAttributes.SOURCE_IMAGE_URL + indexString))
                {
                    sourceImageUrl = feature.Attributes[FeatureAttributes.SOURCE_IMAGE_URL + indexString].ToString();
                }
                else if (feature.Attributes.Exists(FeatureAttributes.SOURCE_IMAGE_URL))
                {
                    sourceImageUrl = feature.Attributes[FeatureAttributes.SOURCE_IMAGE_URL].ToString();
                }
                references.Add(new Reference
                {
                    Url = url,
                    SourceImageUrl = sourceImageUrl
                });
            }
            return references.ToArray();
        }

        /// <summary>
        /// This method will get from cahce if the items was stored there.
        /// </summary>
        /// <param name="id"></param>
        /// <returns></returns>
        protected async Task<FeatureCollection> GetFromCacheIfExists(string id)
        {
            var featureCollection = await _elasticSearchGateway.GetCachedItemById(id, Source);
            if (featureCollection == null)
            {
                return null;
            }
            var feature = featureCollection.First();
            if (!feature.Attributes.Exists(FeatureAttributes.POI_CACHE_DATE))
            {
                return null;
            }
            var date = DateTime.Parse(feature.Attributes[FeatureAttributes.POI_CACHE_DATE].ToString());
            return (date - DateTime.Now).TotalDays <= _options.DaysToKeepPoiInCache 
                ? featureCollection 
                : null;
        }

        /// <summary>
        /// This method saves a complete feature to cache.
        /// </summary>
        /// <param name="feature"></param>
        protected FeatureCollection SetToCache(Feature feature)
        {
            var featureCollection = new FeatureCollection { feature };
            SetToCache(featureCollection);
            return featureCollection;
        }

        /// <summary>
        /// 
        /// </summary>
        /// <param name="featureCollection"></param>
        /// <returns></returns>
        protected void SetToCache(FeatureCollection featureCollection)
        {
            featureCollection.First().Attributes.AddOrUpdate(FeatureAttributes.POI_CACHE_DATE, DateTime.Now.ToString("o"));
            _elasticSearchGateway.CacheItem(featureCollection);
        }
    }
}
