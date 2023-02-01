﻿using IsraelHiking.API.Executors;
using IsraelHiking.API.Services;
using IsraelHiking.API.Services.Poi;
using IsraelHiking.Common;
using IsraelHiking.Common.Api;
using IsraelHiking.Common.Configuration;
using IsraelHiking.Common.Extensions;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Caching.Distributed;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using NetTopologySuite.Features;
using OsmSharp.IO.API;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using IsraelHiking.API.Services.Osm;

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
        private readonly IPointsOfInterestProvider _pointsOfInterestProvider;
        private readonly IImagesUrlsStorageExecutor _imageUrlStoreExecutor;
        private readonly ISimplePointAdderExecutor _simplePointAdderExecutor;
        private readonly IDistributedCache _persistentCache;
        private readonly ILogger _logger;
        private readonly ConfigurationData _options;

        /// <summary>
        /// Controller's constructor
        /// </summary>
        /// <param name="clientsFactory"></param>
        /// <param name="tagsHelper"></param>
        /// <param name="pointsOfInterestProvider"></param>
        /// <param name="imageUrlStoreExecutor"></param>
        /// <param name="simplePointAdderExecutor"></param>
        /// <param name="persistentCache"></param>
        /// <param name="logger"></param>
        /// <param name="options"></param>
        public PointsOfInterestController(IClientsFactory clientsFactory,
            ITagsHelper tagsHelper,
            IPointsOfInterestProvider pointsOfInterestProvider,
            IImagesUrlsStorageExecutor imageUrlStoreExecutor,
            ISimplePointAdderExecutor simplePointAdderExecutor,
            IDistributedCache persistentCache,
            ILogger logger,
            IOptions<ConfigurationData> options)
        {
            _clientsFactory = clientsFactory;
            _tagsHelper = tagsHelper;
            _imageUrlStoreExecutor = imageUrlStoreExecutor;
            _pointsOfInterestProvider = pointsOfInterestProvider;
            _simplePointAdderExecutor = simplePointAdderExecutor;
            _persistentCache = persistentCache;
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
        public async Task<IFeature[]> GetPointsOfInterest(string northEast, string southWest, string categories,
            string language = "")
        {
            if (string.IsNullOrWhiteSpace(categories))
            {
                return Array.Empty<IFeature>();
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
        /// <returns></returns>
        [Route("{source}/{id}")]
        [HttpGet]
        public async Task<IActionResult> GetPointOfInterest(string source, string id)
        {
            var poiItem = await _pointsOfInterestProvider.GetFeatureById(source, id);
            if (poiItem == null)
            {
                return NotFound();
            }
            return Ok(poiItem);
        }

        /// <summary>
        /// Creates a POI by id and source, upload the image to wikimedia commons if needed.
        /// </summary>
        /// <param name="feature"></param>
        /// <param name="language">The language code</param>
        /// <returns></returns>
        [Route("")]
        [HttpPost]
        [Authorize]
        public async Task<IActionResult> CreatePointOfInterest([FromBody]Feature feature,
            [FromQuery] string language)
        {
            _logger.LogInformation("Processing create point of interest request");
            var validationResults = ValidateFeature(feature, language);
            if (!string.IsNullOrEmpty(validationResults))
            {
                _logger.LogWarning("Create request validation failed: " + validationResults);
                return BadRequest(validationResults);
            }
            if (feature.Attributes.Exists(FeatureAttributes.POI_IS_SIMPLE))
            {
                await AddSimplePoint(new AddSimplePointOfInterestRequest
                {
                    Guid = feature.GetId(),
                    LatLng = new LatLng(feature.GetLocation().Y, feature.GetLocation().X),
                    PointType = Enum.Parse<SimplePointType>(feature.Attributes[FeatureAttributes.POI_TYPE].ToString(), true)
                });
                return Ok();
            }
            var mappedId = _persistentCache.GetString(feature.GetId());
            if (!string.IsNullOrEmpty(mappedId))
            {
                var featureFromDatabase = await _pointsOfInterestProvider.GetFeatureById(feature.Attributes[FeatureAttributes.POI_SOURCE].ToString(), mappedId);
                if (featureFromDatabase == null)
                {
                    return BadRequest("Feature is still in process please try again later...");
                }
                return Ok(featureFromDatabase);
            }
            _persistentCache.SetString(feature.GetId(), "In process", new DistributedCacheEntryOptions { AbsoluteExpirationRelativeToNow = TimeSpan.FromDays(30) });
            
            var osmGateway = OsmAuthFactoryWrapper.ClientFromUser(User, _clientsFactory, _options);
            var newFeature = await _pointsOfInterestProvider.AddFeature(feature, osmGateway, language);
            _persistentCache.SetString(feature.GetId(), newFeature.Attributes[FeatureAttributes.ID].ToString(), new DistributedCacheEntryOptions { AbsoluteExpirationRelativeToNow = TimeSpan.FromDays(30) });
            return Ok(newFeature);
        }

        /// <summary>
        /// Creates a POI by id and source, upload the image to wikimedia commons if needed.
        /// </summary>
        /// <param name="id">The feature ID</param>
        /// <param name="feature"></param>
        /// <param name="language">The language code</param>
        /// <returns></returns>
        [Route("{id}")]
        [HttpPut]
        [Authorize]
        public async Task<IActionResult> UpdatePointOfInterest(string id, [FromBody]Feature feature,
            [FromQuery] string language)
        {
            _logger.LogInformation("Processing update point of interest request");
            var validationResults = ValidateFeature(feature, language);
            if (!string.IsNullOrEmpty(validationResults))
            {
                _logger.LogWarning("Update request validation failed: " + validationResults);
                return BadRequest(validationResults);
            }
            if (feature.GetId() != id) {
                return BadRequest("Feature ID and supplied id do not match...");
            }
            
            var osmGateway = OsmAuthFactoryWrapper.ClientFromUser(User, _clientsFactory, _options);
            return Ok(await _pointsOfInterestProvider.UpdateFeature(feature, osmGateway, language));
        }

        private string ValidateFeature(Feature feature, string language) 
        {
            if (!feature.Attributes[FeatureAttributes.POI_SOURCE].ToString().Equals(Sources.OSM, StringComparison.InvariantCultureIgnoreCase))
            {
                return "OSM is the only supported source for this action...";
            }
            if (feature.GetDescription(language).Length > 255)
            {
                return "Description must not be more than 255 characters...";
            }
            if (feature.GetTitle(language).Length > 255)
            {
                return "Title must not be more than 255 characters...";
            }

            var invalidWebsites = feature.Attributes.GetNames()
                .Where(n => n.StartsWith(FeatureAttributes.WEBSITE))
                .Select(n => feature.Attributes[n].ToString())
                .Any(w => w.Length > 255);
            var invalidAddedWebsites = feature.Attributes.GetNames()
                .Where(n => n == FeatureAttributes.POI_ADDED_URLS)
                .SelectMany(n => feature.Attributes[n] as IEnumerable<object>)
                .Any(w => w.ToString().Length > 255);
            if (invalidWebsites || invalidAddedWebsites)
            {
                return "Website address length must not be more than 255 characters...";
            }
            return string.Empty;
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
        public Task<IFeature> GetClosestPoint(string location, string source, string language)
        {
            return _pointsOfInterestProvider.GetClosestPoint(location.ToCoordinate(), source, language);
        }

        /// <summary>
        /// Get POIs that were updated between lastModified and modifiedUntil or now if not provided
        /// </summary>
        /// <param name="lastModified">Start date for updates</param>
        /// <param name="modifiedUntil">End date for updates</param>
        /// <returns></returns>
        [Route("updates/{lastModified}/")]
        [Route("updates/{lastModified}/{modifiedUntil}")]
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
        /// Creates a simple POI
        /// </summary>
        /// <param name="request"></param>
        /// <returns></returns>
        private async Task AddSimplePoint(AddSimplePointOfInterestRequest request)
        {
            if (!string.IsNullOrEmpty(_persistentCache.GetString(request.Guid))) {
                return;
            }
            _persistentCache.SetString(request.Guid, "In process", new DistributedCacheEntryOptions { AbsoluteExpirationRelativeToNow = TimeSpan.FromDays(30) });
            _logger.LogInformation($"Adding a simple POI of type {request.PointType} at {request.LatLng.Lat}, {request.LatLng.Lng}");
            var osmGateway = OsmAuthFactoryWrapper.ClientFromUser(User, _clientsFactory, _options);
            await _simplePointAdderExecutor.Add(osmGateway, request);
        }
    }
}