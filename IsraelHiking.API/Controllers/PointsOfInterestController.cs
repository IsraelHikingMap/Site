using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using GeoAPI.Geometries;
using IsraelHiking.API.Services;
using IsraelHiking.API.Services.Poi;
using IsraelHiking.Common;
using IsraelHiking.DataAccessInterfaces;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;

namespace IsraelHiking.API.Controllers
{
    /// <summary>
    /// This controller allows viewing, editing and filtering of points of interest (POI)
    /// </summary>
    [Route("api/poi")]
    public class PointsOfInterestController : Controller
    {
        private readonly Dictionary<string, IPointsOfInterestAdapter> _adapters;
        private readonly ITagsHelper _tagsHelper;
        private readonly IWikipediaGateway _wikipediaGateway;
        private readonly LruCache<string, TokenAndSecret> _cache;

        /// <summary>
        /// Controller's constructor
        /// </summary>
        /// <param name="adapters"></param>
        /// <param name="wikipediaGateway"></param>
        /// <param name="cache"></param>
        /// <param name="tagsHelper"></param>
        public PointsOfInterestController(IEnumerable<IPointsOfInterestAdapter> adapters,
            ITagsHelper tagsHelper,
            IWikipediaGateway wikipediaGateway,
            LruCache<string, TokenAndSecret> cache)
        {
            _adapters = adapters.ToDictionary(a => a.Source, a => a);

            _tagsHelper = tagsHelper;
            _cache = cache;
            _wikipediaGateway = wikipediaGateway;
        }

        /// <summary>
        /// Gets the available categories for the specified type
        /// </summary>
        /// <param name="categoriesType">The categories' type</param>
        /// <returns></returns>
        [Route("categories/{categoriesType}")]
        [HttpGet]
        public Dictionary<string, IEnumerable<IconColorCategory>> GetCategoriesByGroup(string categoriesType)
        {
            return _tagsHelper.GetIconsPerCategoryByType(categoriesType);
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
        public async Task<PointOfInterest[]> GetPointsOfInterest(string northEast, string southWest, string categories,
            string language = "")
        {
            if (string.IsNullOrWhiteSpace(categories))
            {
                return new PointOfInterest[0];
            }
            var categoriesArray = categories.Split(',').Select(f => f.Trim()).ToArray();
            var northEastCoordinate = new Coordinate().FromLatLng(northEast);
            var southWestCoordinate = new Coordinate().FromLatLng(southWest);
            var poiList = new List<PointOfInterest>();
            foreach (var adapter in _adapters.Values)
            {
                poiList.AddRange(await adapter.GetPointsOfInterest(northEastCoordinate, southWestCoordinate,
                    categoriesArray, language));
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

        /// <summary>
        /// Update a POI by id and source
        /// </summary>
        /// <param name="pointOfInterest"></param>
        /// <param name="language"></param>
        /// <returns></returns>
        [Route("")]
        [HttpPost]
        [Authorize]
        public async Task<IActionResult> UploadPointOfInterest([FromBody] PointOfInterestExtended pointOfInterest,
            string language = "")
        {
            if (_adapters.ContainsKey(pointOfInterest.Source) == false)
            {
                return BadRequest($"{pointOfInterest.Source} is not a know POIs source...");
            }
            var adapter = _adapters[pointOfInterest.Source];
            var tokenAndSecret = _cache.Get(User.Identity.Name);
            if (string.IsNullOrWhiteSpace(pointOfInterest.Id))
            {
                return Ok(await adapter.AddPointOfInterest(pointOfInterest, tokenAndSecret, language));
            }
            return Ok(await adapter.UpdatePointOfInterest(pointOfInterest, tokenAndSecret, language));
        }

        /// <summary>
        /// Upload an image to wikimedia common
        /// </summary>
        /// <param name="file">The image file to upload</param>
        /// <param name="title">The title to upload it with</param>
        /// <param name="location">The location the image was taken</param>
        /// <returns></returns>
        [HttpPost]
        [Route("image/")]
        public async Task<IActionResult> UploadImage([FromForm] IFormFile file, [FromQuery] string title,
            [FromQuery] string location)
        {
            var name = string.IsNullOrWhiteSpace(title) ? file.FileName : title;
            var imageName =
                await _wikipediaGateway.UploadImage(name, file.OpenReadStream(), new Coordinate().FromLatLng(location));
            var url = await _wikipediaGateway.GetImageUrl(imageName);
            return Ok(url);
        }
    }
}