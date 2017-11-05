using System.Collections.ObjectModel;
using System.Linq;
using System.Threading.Tasks;
using GeoAPI.Geometries;
using IsraelHiking.API.Gpx;
using IsraelHiking.Common;
using IsraelHiking.DataAccessInterfaces;
using NetTopologySuite.Features;

namespace IsraelHiking.API.Services.Poi
{
    /// <summary>
    /// Base class for points of interest adapter
    /// </summary>
    public abstract class BasePointsOfInterestAdapter
    {
        private readonly IElevationDataStorage _elevationDataStorage;
        private readonly IElasticSearchGateway _elasticSearchGateway;
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
            poiItem.Title = GetAttributeByLanguage(feature.Attributes, FeatureAttributes.NAME, language);
            poiItem.Id = feature.Attributes[FeatureAttributes.ID].ToString();
            poiItem.Source = feature.Attributes[FeatureAttributes.POI_SOURCE].ToString();
            poiItem.Icon = feature.Attributes[FeatureAttributes.ICON].ToString();
            poiItem.IconColor = feature.Attributes[FeatureAttributes.ICON_COLOR].ToString();
            poiItem.Type = feature.Attributes[FeatureAttributes.POI_TYPE].ToString();
            return poiItem;
        }

        /// <summary>
        /// Get an attribute by language, this is relevant to OSM attributes convetion
        /// </summary>
        /// <param name="attributes">The attributes table</param>
        /// <param name="key">The attribute name</param>
        /// <param name="language">The user interface language</param>
        /// <returns></returns>
        protected string GetAttributeByLanguage(IAttributesTable attributes, string key, string language)
        {
            if (attributes.GetNames().Contains(key + ":" + language))
            {
                return attributes[key + ":" + language].ToString();
            }
            if (attributes.GetNames().Contains(key))
            {
                return attributes[key].ToString();
            }
            return string.Empty;
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
            poiItem.DataContainer = await  _dataContainerConverterService.ToDataContainer(new FeatureCollection(new Collection<IFeature> { feature }).ToBytes(), poiItem.Title + ".geojson");
            // HM TODO: elevation?
            poiItem.Url = feature.Attributes.GetNames().Contains(FeatureAttributes.WEBSITE)
                ? feature.Attributes[FeatureAttributes.WEBSITE].ToString()
                : string.Empty;
            poiItem.ImagesUrls = feature.Attributes.GetNames()
                .Where(n => n.StartsWith(FeatureAttributes.IMAGE_URL))
                .Select(n => feature.Attributes[n].ToString())
                .ToArray();
            poiItem.SourceImageUrl = feature.Attributes.GetNames().Contains(FeatureAttributes.SOURCE_IMAGE_URL)
                ? feature.Attributes[FeatureAttributes.SOURCE_IMAGE_URL].ToString()
                : string.Empty;
            poiItem.Description = GetAttributeByLanguage(feature.Attributes, FeatureAttributes.DESCRIPTION, language);
            poiItem.Rating = await _elasticSearchGateway.GetRating(poiItem.Id, poiItem.Source);
            poiItem.IsEditable = false;
        }
    }
}
