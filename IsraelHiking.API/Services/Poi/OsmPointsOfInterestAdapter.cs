using System.Collections.ObjectModel;
using System.Linq;
using System.Text.RegularExpressions;
using System.Threading.Tasks;
using GeoAPI.Geometries;
using IsraelHiking.Common;
using IsraelHiking.DataAccessInterfaces;
using NetTopologySuite.Features;
using NetTopologySuite.Geometries;
using OsmSharp;
using OsmSharp.Tags;

namespace IsraelHiking.API.Services.Poi
{
    /// <inheritdoc />
    public class OsmPointsOfInterestAdapter : IPointsOfInterestAdapter
    {
        private readonly IElasticSearchGateway _elasticSearchGateway;
        private readonly IElevationDataStorage _elevationDataStorage;
        private readonly IHttpGatewayFactory _httpGatewayFactory;

        /// <summary>
        /// Adapter's constructor
        /// </summary>
        /// <param name="elasticSearchGateway"></param>
        /// <param name="elevationDataStorage"></param>
        /// <param name="httpGatewayFactory"></param>
        public OsmPointsOfInterestAdapter(IElasticSearchGateway elasticSearchGateway, 
            IElevationDataStorage elevationDataStorage,
            IHttpGatewayFactory httpGatewayFactory)
        {
            _elasticSearchGateway = elasticSearchGateway;
            _elevationDataStorage = elevationDataStorage;
            _httpGatewayFactory = httpGatewayFactory;
        }
        /// <inheritdoc />
        public string Source => FeatureAttributes.OSM;

        /// <inheritdoc />
        public async Task<PointOfInterest[]> GetPointsOfInterest(Coordinate northEast, Coordinate southWest, string[] categories, string language)
        {
            var features = await _elasticSearchGateway.GetPointsOfInterest(northEast, southWest, categories);
            return await Task.WhenAll(features.Select(f => ConvertToPoiItem<PointOfInterest>(f, language)));
        }

        /// <inheritdoc />
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

        /// <inheritdoc />
        public async Task UpdatePointOfInterest(PointOfInterestExtended pointOfInterest, TokenAndSecret tokenAndSecret, string language)
        {
            var osmGateway = _httpGatewayFactory.CreateOsmGateway(tokenAndSecret);
            var feature = await _elasticSearchGateway.GetPointOfInterestById(pointOfInterest.Id, FeatureAttributes.OSM);
            SetAtttibuteByLanguage(feature.Attributes, FeatureAttributes.DESCRIPTION, pointOfInterest.Description, language);
            await _elasticSearchGateway.UpdateNamesData(feature);
            var id = feature.Attributes[FeatureAttributes.ID].ToString();
            OsmGeo osmGeo;
            if (feature.Geometry is Point)
            {
                osmGeo = await osmGateway.GetNode(id);
            }
            else if (feature.Geometry is LineString || feature.Geometry is Polygon)
            {
                osmGeo = await osmGateway.GetWay(id);
            }
            else
            {
                osmGeo = await osmGateway.GetRelation(id);
            }
            SetTagByLanguage(osmGeo.Tags, FeatureAttributes.DESCRIPTION, pointOfInterest.Description, language);

            var changesetId = await osmGateway.CreateChangeset("Update POI interface from IHM site.");
            await osmGateway.UpdateElement(changesetId, osmGeo);
            await osmGateway.CloseChangeset(changesetId);
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

        private void SetAtttibuteByLanguage(IAttributesTable attributes, string key, string value, string language)
        {
            language = GetLanguage(value, language);
            var keyWithLanguage = key + ":" + language;
            if (string.IsNullOrWhiteSpace(value) && attributes.GetNames().Contains(keyWithLanguage))
            {
                attributes.DeleteAttribute(keyWithLanguage);
                return;
            }
            if (attributes.GetNames().Contains(keyWithLanguage))
            {
                attributes[keyWithLanguage] = value;
                return;
            }
            attributes.AddAttribute(keyWithLanguage, value);
        }

        private void SetTagByLanguage(TagsCollectionBase tags, string key, string value, string language)
        {
            language = GetLanguage(value, language);
            var keyWithLanguage = key + ":" + language;
            if (string.IsNullOrWhiteSpace(value) && tags.ContainsKey(keyWithLanguage))
            {
                tags.RemoveKey(keyWithLanguage);
                return;
            }
            if (tags.ContainsKey(keyWithLanguage))
            {
                tags[keyWithLanguage] = value;
                return;
            }
            tags.Add(new Tag(keyWithLanguage, value));
        }


        private string GetLanguage(string value, string language)
        {
            if (string.IsNullOrWhiteSpace(value))
            {
                return language;
            }
            language = "he";
            if (HasHebrewCharacters(value) == false)
            {
                language = "en";
            }
            return language;
        }
        private bool HasHebrewCharacters(string words)
        {
            return Regex.Match(words, @"^[^a-zA-Z]*[\u0591-\u05F4]").Success;
        }

        
    }
}
