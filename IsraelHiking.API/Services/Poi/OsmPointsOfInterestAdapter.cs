using System;
using System.Collections.ObjectModel;
using System.Linq;
using System.Threading.Tasks;
using GeoAPI.Geometries;
using IsraelHiking.Common;
using IsraelHiking.DataAccessInterfaces;
using NetTopologySuite.Features;

namespace IsraelHiking.API.Services.POI
{
    public class OsmPointsOfInterestAdapter : IPointsOfInterestAdapter
    {
        private readonly IElasticSearchGateway _elasticSearchGateway;
        private readonly IElevationDataStorage _elevationDataStorage;

        public OsmPointsOfInterestAdapter(IElasticSearchGateway elasticSearchGateway, 
            IElevationDataStorage elevationDataStorage)
        {
            _elasticSearchGateway = elasticSearchGateway;
            _elevationDataStorage = elevationDataStorage;
        }

        public string Source => FeatureAttributes.OSM;

        public async Task<PointOfInterest[]> GetPointsOfInterest(Coordinate northEast, Coordinate southWest, string[] categories, string language)
        {
            var features = await _elasticSearchGateway.GetPointsOfInterest(northEast, southWest, categories);
            return await Task.WhenAll(features.Select(f => ConvertToPoiItem<PointOfInterest>(f, language)));
        }

        public async Task<PointOfInterestExtended> GetPointOfInterestById(string id, string language)
        {
            var feature = await _elasticSearchGateway.GetPointOfInterestById(id, FeatureAttributes.OSM);
            var poiItem = await ConvertToPoiItem<PointOfInterestExtended>(feature, language);
            poiItem.FeatureCollection = new FeatureCollection(new Collection<IFeature> { feature });
            poiItem.Url = feature.Attributes[FeatureAttributes.EXTERNAL_URL].ToString();
            poiItem.Description = GetAttributeByLanguage(feature.Attributes, FeatureAttributes.DESCRIPTION, language);
            poiItem.Rating = null;
            return poiItem;
        }

        public Task UpdatePointOfInterest(PointOfInterestExtended pointOfInterest)
        {
            var feature = _elasticSearchGateway.GetPointOfInterestById(pointOfInterest.Id, FeatureAttributes.OSM);
            throw new NotImplementedException();
        }

        private async Task<TPoiItem> ConvertToPoiItem<TPoiItem>(IFeature feature, string language) where TPoiItem : PointOfInterest, new()
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

        private string GetAttributeByLanguage(IAttributesTable attributes, string key, string language)
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
    }
}
