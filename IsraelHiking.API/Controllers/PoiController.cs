using System.Collections.Generic;
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
        [Route("filters")]
        [HttpGet]
        public string[] GetFilters()
        {
            return new[]
            {
                "campsite",
                "spring",
                "viewpoint",
                "ruins",
                "other"
            };
        }
        /// <summary>
        /// Get points of interest in a bounding box.
        /// </summary>
        /// <param name="northEast">North east bounding box corner</param>
        /// <param name="southWest">South west bounding box corner</param>
        /// <param name="filters">The relevant filters to include</param>
        /// <returns>A list of GeoJSON features</returns>
        [Route("")]
        [HttpGet]
        public async Task<List<Feature>> GetPointsOfInterest(string northEast, string southWest, string filters)
        {
            var filtersArray = filters?.Split(',').Select(f => f.Trim()).ToArray() ?? GetFilters();

            var features = await _elasticSearchGateway.GetPointsOfInterest(
                new Coordinate().FromLatLng(northEast),
                new Coordinate().FromLatLng(southWest), 
                filtersArray);

            foreach (var feature in features)
            {
                if (feature.Geometry.Coordinate == null)
                {
                    continue;
                }
                feature.Attributes.AddAttribute("altitude", 
                    await _elevationDataStorage.GetElevation(feature.Geometry.Coordinate));
            }

            return features;
        }
    }
}
