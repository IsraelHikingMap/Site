using System;
using System.Collections.Generic;
using System.Collections.ObjectModel;
using System.Linq;
using System.Text;
using System.Threading.Tasks;
using GeoAPI.Geometries;
using IsraelHiking.Common;
using IsraelHiking.DataAccessInterfaces;
using NetTopologySuite.Features;

namespace IsraelHiking.API.Services.Poi
{
    public class BasePoiAdapter
    {
        private readonly IElevationDataStorage _elevationDataStorage;

        public BasePoiAdapter(IElevationDataStorage elevationDataStorage)
        {
            _elevationDataStorage = elevationDataStorage;
        }

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

        protected void AddExtendedData(PointOfInterestExtended poiItem, IFeature feature, string language)
        {
            poiItem.FeatureCollection = new FeatureCollection(new Collection<IFeature> { feature });
            poiItem.Url = feature.Attributes[FeatureAttributes.WEBSITE].ToString();
            poiItem.Description = GetAttributeByLanguage(feature.Attributes, FeatureAttributes.DESCRIPTION, language);
            poiItem.Rating = null;
            poiItem.IsEditable = true;
        }
    }
}
