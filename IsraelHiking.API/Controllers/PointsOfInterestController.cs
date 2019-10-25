using IsraelHiking.API.Converters;
using IsraelHiking.API.Services;
using IsraelHiking.API.Services.Poi;
using IsraelHiking.Common;
using IsraelHiking.Common.Poi;
using IsraelHiking.DataAccessInterfaces;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Options;
using OsmSharp.IO.API;
using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Threading.Tasks;

namespace IsraelHiking.API.Controllers
{
    /// <summary>
    /// This controller allows viewing, editing and filtering of points of interest (POI)
    /// </summary>
    [Route("api/poi")]
    public class PointsOfInterestController : ControllerBase
    {
        private readonly IClientsFactory _clientsFactory;
        private readonly ITagsHelper _tagsHelper;
        private readonly IWikimediaCommonGateway _wikimediaCommonGateway;
        private readonly IPointsOfInterestProvider _pointsOfInterestProvider;
        private readonly IPointsOfInterestAggregatorService _pointsOfInterestAggregatorService;
        private readonly IBase64ImageStringToFileConverter _base64ImageConverter;
        private readonly ConfigurationData _options;
        private readonly LruCache<string, TokenAndSecret> _cache;

        /// <summary>
        /// Controller's constructor
        /// </summary>
        /// <param name="clientsFactory"></param>
        /// <param name="tagsHelper"></param>
        /// <param name="wikimediaCommonGateway"></param>
        /// <param name="pointsOfInterestProvider"></param>
        /// <param name="pointsOfInterestAggregatorService"></param>
        /// <param name="base64ImageConverter"></param>
        /// <param name="options"></param>
        /// <param name="cache"></param>
        public PointsOfInterestController(IClientsFactory clientsFactory,
            ITagsHelper tagsHelper,
            IWikimediaCommonGateway wikimediaCommonGateway,
            IPointsOfInterestProvider pointsOfInterestProvider,
            IPointsOfInterestAggregatorService pointsOfInterestAggregatorService,
            IBase64ImageStringToFileConverter base64ImageConverter,
            IOptions<ConfigurationData> options,
            LruCache<string, TokenAndSecret> cache)
        {
            _clientsFactory = clientsFactory;
            _tagsHelper = tagsHelper;
            _cache = cache;
            _base64ImageConverter = base64ImageConverter;
            _pointsOfInterestAggregatorService = pointsOfInterestAggregatorService;
            _pointsOfInterestProvider = pointsOfInterestProvider;
            _wikimediaCommonGateway = wikimediaCommonGateway;
            _options = options.Value;
        }

        /// <summary>
        /// Gets the available categories for the specified type
        /// </summary>
        /// <param name="categoriesType">The categories' type</param>
        /// <returns></returns>
        [Route("categories/{categoriesType}")]
        [HttpGet]
        public IEnumerable<Category> GetCategoriesByType(string categoriesType)
        {
            return _tagsHelper.GetCategoriesByType(categoriesType);
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
            var northEastCoordinate = northEast.ToCoordinate();
            var southWestCoordinate = southWest.ToCoordinate();
            return await _pointsOfInterestProvider.GetPointsOfInterest(northEastCoordinate, southWestCoordinate, categoriesArray, language);
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
            if (source.Equals(Sources.COORDINATES, StringComparison.InvariantCultureIgnoreCase))
            {
                var latLng = SearchResultsPointOfInterestConverter.GetLatLngFromId(id);
                return Ok(SearchResultsPointOfInterestConverter.FromLatlng(latLng, id));
            }
            var poiItem = await _pointsOfInterestAggregatorService.Get(source, id, language);
            if (poiItem == null)
            {
                return NotFound();
            }
            return Ok(poiItem);
        }

        /// <summary>
        /// Update a POI by id and source, upload the image to wikimedia commons if needed.
        /// </summary>
        /// <param name="pointOfInterest"></param>
        /// <param name="language">The language code</param>
        /// <returns></returns>
        [Route("")]
        [HttpPost]
        [Authorize]
        public async Task<IActionResult> UploadPointOfInterest([FromBody]PointOfInterestExtended pointOfInterest,
            [FromQuery] string language)
        {
            if (!pointOfInterest.Source.Equals(Sources.OSM, StringComparison.InvariantCultureIgnoreCase))
            {
                return BadRequest("OSM is the only supported source for this action...");
            }
            var tokenAndSecret = _cache.Get(User.Identity.Name);
            var osmGateway = _clientsFactory.CreateOAuthClient(_options.OsmConfiguration.ConsumerKey, _options.OsmConfiguration.ConsumerSecret, tokenAndSecret.Token, tokenAndSecret.TokenSecret);
            var user = await osmGateway.GetUserDetails();
            var imageUrls = pointOfInterest.ImagesUrls ?? new string[0];
            for (var urlIndex = 0; urlIndex < imageUrls.Length; urlIndex++)
            {
                var url = imageUrls[urlIndex];
                var fileName = string.IsNullOrWhiteSpace(pointOfInterest.Title)
                    ? pointOfInterest.Icon.Replace("icon-", "")
                    : pointOfInterest.Title;
                var file = _base64ImageConverter.ConvertToFile(url, fileName);
                if (file == null)
                {
                    continue;
                }
                using (var memoryStream = new MemoryStream(file.Content))
                {
                    var imageName = await _wikimediaCommonGateway.UploadImage(pointOfInterest.Title,
                        pointOfInterest.Description, user.DisplayName, file.FileName, memoryStream,
                        pointOfInterest.Location.ToCoordinate());
                    url = await _wikimediaCommonGateway.GetImageUrl(imageName);
                    imageUrls[urlIndex] = url;
                }
                    
            }

            if (string.IsNullOrWhiteSpace(pointOfInterest.Id))
            {
                return Ok(await _pointsOfInterestProvider.AddPointOfInterest(pointOfInterest, tokenAndSecret, language));
            }
            return Ok(await _pointsOfInterestProvider.UpdatePointOfInterest(pointOfInterest, tokenAndSecret, language));
        }
    }
}