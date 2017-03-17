﻿using System.Collections.ObjectModel;
using System.Linq;
using System.Threading.Tasks;
using GeoAPI.Geometries;
using IsraelHiking.API.Gpx;
using IsraelHiking.API.Services;
using IsraelHiking.Common;
using IsraelHiking.DataAccessInterfaces;
using NetTopologySuite.Features;
using Microsoft.AspNetCore.Mvc;

namespace IsraelHiking.API.Controllers
{
    /// <summary>
    /// This contoller allows search of geo-locations
    /// </summary>
    [Route("api/[controller]")]
    public class SearchController : Controller
    {
        private readonly IElevationDataStorage _elevationDataStorage;
        private readonly IElasticSearchGateway _elasticSearchGateway;
        private readonly IDataContainerConverterService _dataContainerConverterService;

        /// <summary>
        /// Controller's constructor
        /// </summary>
        /// <param name="elasticSearchGateway"></param>
        /// <param name="dataContainerConverterService"></param>
        /// <param name="elevationDataStorage"></param>
        public SearchController(IElasticSearchGateway elasticSearchGateway, 
            IDataContainerConverterService dataContainerConverterService, 
            IElevationDataStorage elevationDataStorage)
        {
            _elasticSearchGateway = elasticSearchGateway;
            _dataContainerConverterService = dataContainerConverterService;
            _elevationDataStorage = elevationDataStorage;
        }

        /// <summary>
        /// Gets a geo location by search term
        /// </summary>
        /// <param name="id">A string to search for</param>
        /// <param name="language">The language to search in</param>
        /// <returns></returns>
        // GET api/search/abc&language=en
        [HttpGet]
        [Route("{term}")]
        public async Task<FeatureCollection> GetSearchResults(string term, string language = null)
        {
            var fieldName = string.IsNullOrWhiteSpace(language) ? "name" : "name:" + language;
            var features = await _elasticSearchGateway.Search(term, fieldName);
            return new FeatureCollection(new Collection<IFeature>(features.OfType<IFeature>().ToList()));
        }

        /// <summary>
        /// Converts a search results to <see cref="DataContainer"/>
        /// </summary>
        /// <param name="feature">The feature to convert</param>
        /// <returns>The converted feature</returns>
        [HttpPost]
        public async Task<DataContainer> PostConvertSearchResults(Feature feature)
        {
            var name = "israelHiking";
            if (feature.Attributes.GetNames().Contains("name"))
            {
                name = feature.Attributes["name"].ToString();
            }
            var featureCollection = new FeatureCollection(new Collection<IFeature> {feature});
            var dataContainer = await _dataContainerConverterService.ToDataContainer(featureCollection.ToBytes(), name + ".geojson");
            foreach (var latLngZ in dataContainer.routes.SelectMany(routeData => routeData.segments.SelectMany(routeSegmentData => routeSegmentData.latlngzs)))
            {
                latLngZ.z = await _elevationDataStorage.GetElevation(new Coordinate().FromLatLng(latLngZ));
            }
            return dataContainer;
        }
    }
}
