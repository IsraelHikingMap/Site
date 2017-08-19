using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using GeoAPI.Geometries;
using IsraelHiking.API.Services.Poi;
using IsraelHiking.Common;
using Microsoft.AspNetCore.Mvc;

namespace IsraelHiking.API.Controllers
{
    /// <summary>
    /// This controller allows viewing, editing and filtering of points of interest (POI)
    /// </summary>
    [Route("api/[controller]")]
    public class PoiController : Controller
    {
        private readonly Dictionary<string, IPointsOfInterestAdapter> _adapters;

        /// <summary>
        /// Controller's constructor
        /// </summary>
        /// <param name="adapters"></param>
        public PoiController(IEnumerable<IPointsOfInterestAdapter> adapters)
        {
            _adapters = adapters.ToDictionary(a => a.Source, a => a);
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
            var northEastCoordinate = new Coordinate().FromLatLng(northEast);
            var southWestCoordinate = new Coordinate().FromLatLng(southWest);
            var poiList = new List<PointOfInterest>();
            foreach (var adapter in _adapters.Values)
            {
                poiList.AddRange(await adapter.GetPointsOfInterest(northEastCoordinate, southWestCoordinate, categoriesArray, language));
            }

            return poiList.ToArray();
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
            if (_adapters.ContainsKey(source) == false)
            {
                return BadRequest($"{source} is not a know POIs source...");
            }
            var adapter = _adapters[source];
            var poiItem = await adapter.GetPointOfInterestById(id, language);
            if (poiItem == null)
            {
                return NotFound();
            }
            return Ok(poiItem);
        }
    }
}
