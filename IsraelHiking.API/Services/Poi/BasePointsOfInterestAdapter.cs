using System.Collections.ObjectModel;
using System.Linq;
using System.Threading.Tasks;
using GeoAPI.Geometries;
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

        /// <summary>
        /// Adapter's constructor
        /// </summary>
        /// <param name="elevationDataStorage"></param>
        /// <param name="elasticSearchGateway"></param>
        protected BasePointsOfInterestAdapter(IElevationDataStorage elevationDataStorage, 
            IElasticSearchGateway elasticSearchGateway)
        {
            _elevationDataStorage = elevationDataStorage;
            _elasticSearchGateway = elasticSearchGateway;
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
            var geoLocation = feature.Attributes[FeatureAttributes.GEOLOCATION] as AttributesTable;
            if (geoLocation != null)
            {
                poiItem.Location = new LatLng((double)geoLocation[FeatureAttributes.LAT], (double)geoLocation[FeatureAttributes.LON]);
                var alt = await _elevationDataStorage.GetElevation(new Coordinate().FromLatLng(poiItem.Location));
                poiItem.Location.alt = alt;
            }
            poiItem.Category = feature.Attributes[FeatureAttributes.POI_CATEGORY].ToString();
            poiItem.Title = GetAttributeByLanguage(feature.Attributes, FeatureAttributes.NAME, language);
            poiItem.Id = feature.Attributes[FeatureAttributes.ID].ToString();
            poiItem.Source = feature.Attributes[FeatureAttributes.POI_SOURCE].ToString();
            poiItem.Icon = feature.Attributes[FeatureAttributes.ICON].ToString();
            poiItem.IconColor = feature.Attributes[FeatureAttributes.ICON_COLOR].ToString();
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
            poiItem.FeatureCollection = new FeatureCollection(new Collection<IFeature> { feature });
            poiItem.Url = feature.Attributes.GetNames().Contains(FeatureAttributes.WEBSITE)
                ? feature.Attributes[FeatureAttributes.WEBSITE].ToString()
                : string.Empty;
            poiItem.ImageUrl = feature.Attributes.GetNames().Contains(FeatureAttributes.IMAGE_URL) 
                ? feature.Attributes[FeatureAttributes.IMAGE_URL].ToString() 
                : string.Empty;
            poiItem.SourceImageUrl = feature.Attributes.GetNames().Contains(FeatureAttributes.SOURCE_IMAGE_URL)
                ? feature.Attributes[FeatureAttributes.SOURCE_IMAGE_URL].ToString()
                : string.Empty;
            poiItem.Description = GetAttributeByLanguage(feature.Attributes, FeatureAttributes.DESCRIPTION, language);
            poiItem.Rating = await _elasticSearchGateway.GetRating(poiItem.Id, poiItem.Source);
            poiItem.IsEditable = true;
        }
    }
}
