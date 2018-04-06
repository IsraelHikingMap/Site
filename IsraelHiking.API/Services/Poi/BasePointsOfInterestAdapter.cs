using System.Collections.Generic;
using System.Collections.ObjectModel;
using System.Linq;
using System.Threading.Tasks;
using GeoAPI.Geometries;
using IsraelHiking.API.Gpx;
using IsraelHiking.Common;
using IsraelHiking.Common.Extensions;
using IsraelHiking.DataAccessInterfaces;
using NetTopologySuite.Features;

namespace IsraelHiking.API.Services.Poi
{
    /// <summary>
    /// Base class for points of interest adapter
    /// </summary>
    public abstract class BasePointsOfInterestAdapter
    {
        /// <summary>
        /// Elasticsearch gateway to be used in derived classes
        /// </summary>
        protected readonly IElasticSearchGateway _elasticSearchGateway;
        private readonly IElevationDataStorage _elevationDataStorage;
        private readonly IDataContainerConverterService _dataContainerConverterService;

        /// <summary>
        /// Adapter's constructor
        /// </summary>
        /// <param name="elevationDataStorage"></param>
        /// <param name="elasticSearchGateway"></param>
        /// <param name="dataContainerConverterService"></param>
        protected BasePointsOfInterestAdapter(IElevationDataStorage elevationDataStorage, 
            IElasticSearchGateway elasticSearchGateway, 
            IDataContainerConverterService dataContainerConverterService)
        {
            _elevationDataStorage = elevationDataStorage;
            _elasticSearchGateway = elasticSearchGateway;
            _dataContainerConverterService = dataContainerConverterService;
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
        /// <param name="poiItem">The object to add properties to</param>
        /// <param name="feature">The feature for reference</param>
        /// <param name="language">he user interface language</param>
        /// <returns></returns>
        protected async Task AddExtendedData(PointOfInterestExtended poiItem, IFeature feature, string language)
        {
            foreach (var coordinate in feature.Geometry.Coordinates)
            {
                coordinate.Z = await _elevationDataStorage.GetElevation(coordinate);
            }
            poiItem.DataContainer = await _dataContainerConverterService.ToDataContainer(new FeatureCollection(new Collection<IFeature> { feature }).ToBytes(), poiItem.Title + ".geojson");
            foreach (var coordinate in poiItem.DataContainer.Routes
                .SelectMany(r => r.Segments)
                .SelectMany(s => s.Latlngs)
                .Where(l => l.Alt == null || l.Alt.Value == 0))
            {
                coordinate.Alt = await _elevationDataStorage.GetElevation(new Coordinate().FromLatLng(coordinate));
            }
            poiItem.References = GetReferences(feature, language);
            poiItem.ImagesUrls = feature.Attributes.GetNames()
                .Where(n => n.StartsWith(FeatureAttributes.IMAGE_URL))
                .Select(n => feature.Attributes[n].ToString())
                .Where(n => !string.IsNullOrWhiteSpace(n))
                .ToArray();
            poiItem.Description = feature.Attributes.GetByLanguage(FeatureAttributes.DESCRIPTION, language);
            poiItem.Rating = await _elasticSearchGateway.GetRating(poiItem.Id, poiItem.Source);
            poiItem.IsEditable = false;
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
    }
}
