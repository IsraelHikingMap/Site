using System;
using System.Collections.ObjectModel;
using System.Linq;
using System.Threading.Tasks;
using GeoAPI.Geometries;
using IsraelHiking.Common;
using IsraelHiking.DataAccessInterfaces;
using Microsoft.AspNetCore.Mvc;
using NetTopologySuite.Features;

namespace IsraelHiking.API.Controllers
{
    /// <summary>
    /// This controller allows viewing, editing and filtering of points of interest (POI)
    /// </summary>
    [Route("api/[controller]")]
    public class PoiController : Controller
    {
        private readonly IElasticSearchGateway _elasticSearchGateway;
        private readonly IElevationDataStorage _elevationDataStorage;

        /// <summary>
        /// Controller's constructor
        /// </summary>
        /// <param name="elasticSearchGateway"></param>
        /// <param name="elevationDataStorage"></param>
        public PoiController(IElasticSearchGateway elasticSearchGateway,
            IElevationDataStorage elevationDataStorage)
        {
            _elasticSearchGateway = elasticSearchGateway;
            _elevationDataStorage = elevationDataStorage;
        }

        /// <summary>
        /// Gets the available filters for POIs
        /// </summary>
        /// <returns></returns>
        [Route("categories")]
        [HttpGet]
        public string[] GetCategories()
        {
            return Categories.All;
        }

        /// <summary>
        /// Get points of interest in a bounding box.
        /// </summary>
        /// <param name="northEast">North east bounding box corner</param>
        /// <param name="southWest">South west bounding box corner</param>
        /// <param name="categories">The relevant categories to include</param>
        /// <param name="language">The required language</param>
        /// <returns>A list of GeoJSON features</returns>
        [Route("")]
        [HttpGet]
        public async Task<PointOfInterest[]> GetPointsOfInterest(string northEast, string southWest, string categories, string language = "")
        {
            var categoriesArray = categories?.Split(',').Select(f => f.Trim()).ToArray() ?? GetCategories();

            var features = await _elasticSearchGateway.GetPointsOfInterest(
                new Coordinate().FromLatLng(northEast),
                new Coordinate().FromLatLng(southWest),
                categoriesArray);

            return await Task.WhenAll(features.Select(f => ConvertToPoiItem<PointOfInterest>(f, language)));
        }

        /// <summary>
        /// Get a POI by id and source
        /// </summary>
        /// <param name="source">The source</param>
        /// <param name="id">The ID</param>
        /// <param name="language">The required language</param>
        /// <returns></returns>
        [Route("{source}/{id}")]
        [HttpGet]
        public async Task<IActionResult> GetPointOfInterest(string source, string id, string language = "")
        {
            var feature = await _elasticSearchGateway.GetPointOfInterestById(id, source);
            if (feature == null)
            {
                return NotFound();
            }
            var poiItem = await ConvertToPoiItem<PointOfInterestExtended>(feature, language);
            poiItem.FeatureCollection = new FeatureCollection(new Collection<IFeature> {feature});
            poiItem.Url = feature.Attributes[FeatureAttributes.EXTERNAL_URL].ToString();
            poiItem.Description = GetAttributeByLanguage(feature.Attributes, FeatureAttributes.DESCRIPTION, language);
            poiItem.Rating = null;
            return Ok(poiItem);
        }

        private async Task<TPoiItem> ConvertToPoiItem<TPoiItem>(Feature feature, string language) where TPoiItem: PointOfInterest, new()
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
