using IsraelHiking.API.Executors;
using IsraelHiking.API.Services;
using IsraelHiking.API.Services.Poi;
using IsraelHiking.Common;
using IsraelHiking.Common.Api;
using IsraelHiking.Common.Extensions;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Caching.Distributed;
using Microsoft.Extensions.Logging;
using NetTopologySuite.Features;
using OsmSharp.IO.API;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using IsraelHiking.API.Services.Osm;

namespace IsraelHiking.API.Controllers;

/// <summary>
/// This controller allows viewing, editing and filtering of points of interest (POI)
/// </summary>
[Route("api/points")]
public class PointsOfInterestController : ControllerBase
{
    private readonly IClientsFactory _clientsFactory;
    private readonly ITagsHelper _tagsHelper;
    private readonly IPointsOfInterestProvider _pointsOfInterestProvider;
    private readonly ISimplePointAdderExecutor _simplePointAdderExecutor;
    private readonly IDistributedCache _persistentCache;
    private readonly ILogger _logger;

    /// <summary>
    /// Controller's constructor
    /// </summary>
    /// <param name="clientsFactory"></param>
    /// <param name="tagsHelper"></param>
    /// <param name="pointsOfInterestProvider"></param>
    /// <param name="simplePointAdderExecutor"></param>
    /// <param name="persistentCache"></param>
    /// <param name="logger"></param>
    public PointsOfInterestController(IClientsFactory clientsFactory,
        ITagsHelper tagsHelper,
        IPointsOfInterestProvider pointsOfInterestProvider,
        ISimplePointAdderExecutor simplePointAdderExecutor,
        IDistributedCache persistentCache,
        ILogger logger)
    {
        _clientsFactory = clientsFactory;
        _tagsHelper = tagsHelper;
        _pointsOfInterestProvider = pointsOfInterestProvider;
        _simplePointAdderExecutor = simplePointAdderExecutor;
        _persistentCache = persistentCache;
        _logger = logger;
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
    public async Task<IActionResult> CreatePointOfInterest([FromBody]IFeature feature,
        [FromQuery] string language)
    {
        _logger.LogInformation("Processing create point of interest request, " + feature.GetId());
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
        if (!string.IsNullOrEmpty(_persistentCache.GetString(feature.GetId())))
        {
            return BadRequest("Feature creation was already requested, ignoring request.");
        }
        _persistentCache.SetString(feature.GetId(), "In process", new DistributedCacheEntryOptions { AbsoluteExpirationRelativeToNow = TimeSpan.FromDays(30) });
            
        var osmGateway = OsmAuthFactoryWrapper.ClientFromUser(User, _clientsFactory);
        var newFeature = await _pointsOfInterestProvider.AddFeature(feature, osmGateway, language);
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
    public async Task<IActionResult> UpdatePointOfInterest(string id, [FromBody]IFeature feature,
        [FromQuery] string language)
    {
        _logger.LogInformation("Processing update point of interest request, " + id);
        var validationResults = ValidateFeature(feature, language);
        if (!string.IsNullOrEmpty(validationResults))
        {
            _logger.LogWarning("Update request validation failed: " + validationResults);
            return BadRequest(validationResults);
        }
        if (feature.GetId() != id) {
            return BadRequest("Feature ID and supplied id do not match...");
        }
            
        var osmGateway = OsmAuthFactoryWrapper.ClientFromUser(User, _clientsFactory);
        return Ok(await _pointsOfInterestProvider.UpdateFeature(feature, osmGateway, language));
    }

    private string ValidateFeature(IFeature feature, string language) 
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
    /// <param name="source">The source to use, empty means no constraints</param>
    /// <param name="language">Optional, if given this is the only language this method will use</param>
    /// <returns></returns>
    [HttpGet]
    [Route("closest")]
    public Task<IFeature> GetClosestPoint(string location, string source, string language)
    {
        return _pointsOfInterestProvider.GetClosestPoint(location.ToCoordinate(), source, language);
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
        var osmGateway = OsmAuthFactoryWrapper.ClientFromUser(User, _clientsFactory);
        await _simplePointAdderExecutor.Add(osmGateway, request);
    }
}