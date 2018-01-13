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
using Newtonsoft.Json;

namespace IsraelHiking.API.Controllers
{
    /// <summary>
    /// This controller allows viewing, editing and filtering of points of interest (POI)
    /// </summary>
    [Route("api/poi")]
    public class PointsOfInterestController : Controller
    {
        private readonly Dictionary<string, IPointsOfInterestAdapter> _adapters;
        private readonly IHttpGatewayFactory _httpGatewayFactory;
        private readonly ITagsHelper _tagsHelper;
        private readonly IWikimediaCommonGateway _wikimediaCommonGateway;
        private readonly LruCache<string, TokenAndSecret> _cache;

        /// <summary>
        /// Controller's constructor
        /// </summary>
        /// <param name="adapters"></param>
        /// <param name="httpGatewayFactory"></param>
        /// <param name="tagsHelper"></param>
        /// <param name="wikimediaCommonGateway"></param>
        /// <param name="cache"></param>
        public PointsOfInterestController(IEnumerable<IPointsOfInterestAdapter> adapters,
            IHttpGatewayFactory httpGatewayFactory,
            ITagsHelper tagsHelper,
            IWikimediaCommonGateway wikimediaCommonGateway,
            LruCache<string, TokenAndSecret> cache)
        {
            _adapters = adapters.ToDictionary(a => a.Source, a => a);

            _httpGatewayFactory = httpGatewayFactory;
            _tagsHelper = tagsHelper;
            _cache = cache;
            _wikimediaCommonGateway = wikimediaCommonGateway;
        }

        /// <summary>
        /// Gets the available categories for the specified type
        /// </summary>
        /// <param name="categoriesType">The categories' type</param>
        /// <returns></returns>
        [Route("categories/{categoriesType}")]
        [HttpGet]
        public Dictionary<string, IEnumerable<IconColorCategory>> GetCategoriesByType(string categoriesType)
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
        /// <param name="type"></param>
        /// <returns></returns>
        [Route("{source}/{id}")]
        [HttpGet]
        public async Task<IActionResult> GetPointOfInterest(string source, string id, string language = "", string type = "")
        {
            if (_adapters.ContainsKey(source) == false)
            {
                return BadRequest($"{source} is not a know POIs source...");
            }
            var adapter = _adapters[source];
            var poiItem = await adapter.GetPointOfInterestById(id, language, type);
            if (poiItem == null)
            {
                return NotFound();
            }
            return Ok(poiItem);
        }

        /// <summary>
        /// Update a POI by id and source, upload the image to wikimedia commons if needed.
        /// </summary>
        /// <param name="file">An image file to add as a URL</param>
        /// <param name="poiData">A JSON string of <see cref="PointOfInterestExtended"/> </param>
        /// <param name="language">The language code</param>
        /// <returns></returns>
        [Route("")]
        [HttpPost]
        [Authorize]
        public async Task<IActionResult> UploadPointOfInterest([FromForm] IFormFile file, 
            [FromForm] string poiData,
            [FromQuery] string language)
        {
            var pointOfInterest = JsonConvert.DeserializeObject<PointOfInterestExtended>(poiData);
            if (_adapters.ContainsKey(pointOfInterest.Source) == false)
            {
                return BadRequest($"{pointOfInterest.Source} is not a know POIs source...");
            }
            if (file != null)
            {
                var osmGateway = _httpGatewayFactory.CreateOsmGateway(_cache.Get(User.Identity.Name));
                var user = await osmGateway.GetUser();
                var imageName = await _wikimediaCommonGateway.UploadImage(pointOfInterest.Title, user.DisplayName, file.FileName, file.OpenReadStream(), new Coordinate().FromLatLng(pointOfInterest.Location));
                var url = await _wikimediaCommonGateway.GetImageUrl(imageName);
                var imageUrls = pointOfInterest.ImagesUrls.ToList();
                imageUrls.Insert(0, url);
                pointOfInterest.ImagesUrls = imageUrls.ToArray();
            }
            
            var adapter = _adapters[pointOfInterest.Source];
            var tokenAndSecret = _cache.Get(User.Identity.Name);
            if (string.IsNullOrWhiteSpace(pointOfInterest.Id))
            {
                return Ok(await adapter.AddPointOfInterest(pointOfInterest, tokenAndSecret, language));
            }
            return Ok(await adapter.UpdatePointOfInterest(pointOfInterest, tokenAndSecret, language));
        }
    }
}