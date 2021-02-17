using IsraelHiking.API.Converters;
using IsraelHiking.API.Executors;
using IsraelHiking.API.Services;
using IsraelHiking.API.Services.Poi;
using IsraelHiking.Common;
using IsraelHiking.Common.Api;
using IsraelHiking.Common.Configuration;
using IsraelHiking.Common.Extensions;
using IsraelHiking.Common.Poi;
using IsraelHiking.DataAccessInterfaces;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using NetTopologySuite.Features;
using NetTopologySuite.Geometries;
using OsmSharp.IO.API;
using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Security.Cryptography;
using System.Threading.Tasks;

namespace IsraelHiking.API.Controllers
{
    /// <summary>
    /// This controller allows viewing, editing and filtering of points of interest (POI)
    /// </summary>
    [Route("api/points")]
    public class PointsOfInterestController : ControllerBase
    {
        private readonly IClientsFactory _clientsFactory;
        private readonly ITagsHelper _tagsHelper;
        private readonly IWikimediaCommonGateway _wikimediaCommonGateway;
        private readonly IPointsOfInterestProvider _pointsOfInterestProvider;
        private readonly IBase64ImageStringToFileConverter _base64ImageConverter;
        private readonly IImagesUrlsStorageExecutor _imageUrlStoreExecutor;
        private readonly ISimplePointAdderExecutor _simplePointAdderExecutor;
        private readonly ILogger _logger;
        private readonly ConfigurationData _options;
        private readonly UsersIdAndTokensCache _cache;

        /// <summary>
        /// Controller's constructor
        /// </summary>
        /// <param name="clientsFactory"></param>
        /// <param name="tagsHelper"></param>
        /// <param name="wikimediaCommonGateway"></param>
        /// <param name="pointsOfInterestProvider"></param>
        /// <param name="base64ImageConverter"></param>
        /// <param name="imageUrlStoreExecutor"></param>
        /// <param name="simplePointAdderExecutor"></param>
        /// <param name="logger"></param>
        /// <param name="options"></param>
        /// <param name="cache"></param>
        public PointsOfInterestController(IClientsFactory clientsFactory,
            ITagsHelper tagsHelper,
            IWikimediaCommonGateway wikimediaCommonGateway,
            IPointsOfInterestProvider pointsOfInterestProvider,
            IBase64ImageStringToFileConverter base64ImageConverter,
            IImagesUrlsStorageExecutor imageUrlStoreExecutor,
            ISimplePointAdderExecutor simplePointAdderExecutor,
            ILogger logger,
            IOptions<ConfigurationData> options,
            UsersIdAndTokensCache cache)
        {
            _clientsFactory = clientsFactory;
            _tagsHelper = tagsHelper;
            _cache = cache;
            _base64ImageConverter = base64ImageConverter;
            _imageUrlStoreExecutor = imageUrlStoreExecutor;
            _pointsOfInterestProvider = pointsOfInterestProvider;
            _wikimediaCommonGateway = wikimediaCommonGateway;
            _simplePointAdderExecutor = simplePointAdderExecutor;
            _logger = logger;
            _options = options.Value;
        }

        /// <summary>
        /// Gets the available categories for the specified type
        /// </summary>
        /// <param name="categoriesGroup">The categories' type</param>
        /// <returns></returns>
        [Route("categories/{categoriesGroup}")]
        [HttpGet]
        public IEnumerable<Category> GetCategoriesByGroup(string categoriesGroup)
        {
            return _tagsHelper.GetCategoriesByGroup(categoriesGroup);
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
        public async Task<Feature[]> GetPointsOfInterest(string northEast, string southWest, string categories,
            string language = "")
        {
            // HM TODO: return only point geometry!
            if (string.IsNullOrWhiteSpace(categories))
            {
                return new Feature[0];
            }
            var categoriesArray = categories.Split(',').Select(f => f.Trim()).ToArray();
            var northEastCoordinate = northEast.ToCoordinate();
            var southWestCoordinate = southWest.ToCoordinate();
            return await _pointsOfInterestProvider.GetFeatures(northEastCoordinate, southWestCoordinate, categoriesArray, language);
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
                var feautre = new Feature(new Point(latLng.Lng, latLng.Lat), new AttributesTable
                {
                    { FeatureAttributes.NAME, id },
                    { FeatureAttributes.POI_ICON, OsmPointsOfInterestAdapter.SEARCH_ICON },
                    { FeatureAttributes.POI_ICON_COLOR, "black" },
                    { FeatureAttributes.POI_CATEGORY, Categories.NONE },
                    { FeatureAttributes.POI_SOURCE, Sources.COORDINATES },
                });
                feautre.SetTitles();
                feautre.SetLocation(latLng.ToCoordinate());
                return Ok(feautre);
            }
            var poiItem = await _pointsOfInterestProvider.GetFeatureById(source, id);
            if (poiItem == null)
            {
                return NotFound();
            }
            return Ok(poiItem);
        }

        /// <summary>
        /// Update a POI by id and source, upload the image to wikimedia commons if needed.
        /// </summary>
        /// <param name="feature"></param>
        /// <param name="language">The language code</param>
        /// <returns></returns>
        [Route("")]
        [HttpPost]
        [Authorize]
        public async Task<IActionResult> UploadPointOfInterest([FromBody]Feature feature,
            [FromQuery] string language)
        {
            if (!feature.Attributes[FeatureAttributes.POI_SOURCE].ToString().Equals(Sources.OSM, StringComparison.InvariantCultureIgnoreCase))
            {
                return BadRequest("OSM is the only supported source for this action...");
            }
            if (feature.GetDescription(language).Length > 255)
            {
                return BadRequest("Description must not be more than 255 characters...");
            }
            if (feature.GetTitle(language).Length > 255)
            {
                return BadRequest("Title must not be more than 255 characters...");
            }
            var icon = feature.Attributes[FeatureAttributes.POI_ICON].ToString();
            var location = feature.GetLocation();
            var idString = feature.Attributes.Exists(FeatureAttributes.POI_ID) ? feature.GetId() : "";
            _logger.LogInformation($"Adding a POI of type {icon} with id: {idString}, at {location.Y}, {location.X}");
            var osmGateway = CreateOsmGateway();
            var user = await osmGateway.GetUserDetails();
            feature.SetTitles();
            var imageUrls = feature.Attributes.GetNames()
                    .Where(n => n.StartsWith(FeatureAttributes.IMAGE_URL))
                    .Select(p => feature.Attributes[p].ToString())
                    .ToArray();
            for (var urlIndex = 0; urlIndex < imageUrls.Length; urlIndex++)
            {
                var fileName = string.IsNullOrWhiteSpace(feature.GetTitle(language))
                    ? icon.Replace("icon-", "")
                    : feature.GetTitle(language);
                var file = _base64ImageConverter.ConvertToFile(imageUrls[urlIndex], fileName);
                if (file == null)
                {
                    continue;
                }
                using var md5 = MD5.Create();
                var imageUrl = await _imageUrlStoreExecutor.GetImageUrlIfExists(md5, file.Content);
                if (imageUrl != null)
                {
                    imageUrls[urlIndex] = imageUrl;
                    continue;
                }
                using var memoryStream = new MemoryStream(file.Content);
                var imageName = await _wikimediaCommonGateway.UploadImage(feature.GetTitle(language),
                    feature.GetDescription(language), user.DisplayName, file.FileName, memoryStream, location);
                imageUrls[urlIndex] = await _wikimediaCommonGateway.GetImageUrl(imageName);
                await _imageUrlStoreExecutor.StoreImage(md5, file.Content, imageUrls[urlIndex]);
            }

            if (string.IsNullOrWhiteSpace(idString))
            {
                return Ok(await _pointsOfInterestProvider.AddFeature(feature, osmGateway, language));
            }
            return Ok(await _pointsOfInterestProvider.UpdateFeature(feature, osmGateway, language));
        }

        /// <summary>
        /// Gets the closest point to a given location.
        /// </summary>
        /// <param name="location">The location string "lat,lon" to search around</param>
        /// <param name="source">Optional, if given this is the only source this methosd will use</param>
        /// <param name="language">Optional, if given this is the only language this method will use</param>
        /// <returns></returns>
        [HttpGet]
        [Route("closest")]
        public Task<Feature> GetClosestPoint(string location, string source, string language)
        {
            return _pointsOfInterestProvider.GetClosestPoint(location.ToCoordinate(), source, language);
        }

        /// <summary>
        /// Get a POI by id and source
        /// </summary>
        /// <param name="lastModified">Start date for updates</param>
        /// <param name="modifiedUntil">End date for updates</param>
        /// <returns></returns>
        [Route("updates/{lastModified}/{modifiedUntil?}")]
        [HttpGet]
        public async Task<UpdatesResponse> GetPointOfInterestUpdates(DateTime lastModified, DateTime? modifiedUntil)
        {
            var response = await _pointsOfInterestProvider.GetUpdates(lastModified, modifiedUntil ?? DateTime.Now);
            var imageUrls = new List<string>();
            foreach (var feature in response.Features)
            {
                var currentImageUrls = feature.Attributes.GetNames()
                    .Where(a => a.StartsWith(FeatureAttributes.IMAGE_URL))
                    .Select(k => feature.Attributes[k].ToString());
                imageUrls.AddRange(currentImageUrls.ToList());
            }
            response.Images = await _imageUrlStoreExecutor.GetAllImagesForUrls(imageUrls.ToArray());
            _logger.LogInformation($"Finished getting POIs updates for {lastModified} - {modifiedUntil}. Features: {response.Features.Length}, Images: {response.Images.Length}");
            return response;
        }

        /// <summary>
        /// Get a POI by id and source
        /// </summary>
        /// <param name="request"></param>
        /// <returns></returns>
        [Route("simple")]
        [HttpPost]
        [Authorize]
        public Task AddSimplePoint([FromBody]AddSimplePointOfInterestRequest request)
        {
            _logger.LogInformation($"Adding a simple POI of type {request.PointType} at {request.LatLng.Lat}, {request.LatLng.Lng}");
            var osmGateway = CreateOsmGateway();
            return _simplePointAdderExecutor.Add(osmGateway, request);
        }

        

        private IAuthClient CreateOsmGateway()
        {
            var tokenAndSecret = _cache.Get(User.Identity.Name);
            return _clientsFactory.CreateOAuthClient(_options.OsmConfiguration.ConsumerKey, _options.OsmConfiguration.ConsumerSecret, tokenAndSecret.Token, tokenAndSecret.TokenSecret);
        }
    }
}