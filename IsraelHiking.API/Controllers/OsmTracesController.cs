using IsraelHiking.API.Converters.ConverterFlows;
using IsraelHiking.API.Services;
using IsraelHiking.Common;
using IsraelHiking.Common.DataContainer;
using IsraelHiking.Common.Extensions;
using IsraelHiking.DataAccessInterfaces.Repositories;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Net.Http.Headers;
using NetTopologySuite.Geometries;
using OsmSharp.API;
using OsmSharp.IO.API;
using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Threading.Tasks;
using IsraelHiking.API.Services.Osm;
using IsraelHiking.DataAccessInterfaces;
using Microsoft.Extensions.Caching.Distributed;
using Microsoft.Extensions.Logging;

namespace IsraelHiking.API.Controllers;

/// <summary>
/// This controller is responsible for managing OSM traces
/// </summary>
[Route("api/osm/trace")]
[Authorize]
public class OsmTracesController : ControllerBase
{
    private readonly IClientsFactory _clientsFactory;
    private readonly IDataContainerConverterService _dataContainerConverterService;
    private readonly IImageCreationGateway _imageCreationGateway;
    private readonly ISearchRepository _searchRepository;
    private readonly IDistributedCache _persistentCache;
    private readonly ILogger _logger;

    /// <summary>
    /// Controller's constructor
    /// </summary>
    /// <param name="clientsFactory"></param>
    /// <param name="dataContainerConverterService"></param>
    /// <param name="imageCreationGateway"></param>
    /// <param name="searchRepository"></param>
    /// <param name="persistentCache"></param>
    /// <param name="logger"></param>
    public OsmTracesController(IClientsFactory clientsFactory,
        IDataContainerConverterService dataContainerConverterService,
        IImageCreationGateway imageCreationGateway,
        ISearchRepository searchRepository,
        IDistributedCache persistentCache, 
        ILogger logger)
    {
        _clientsFactory = clientsFactory;
        _dataContainerConverterService = dataContainerConverterService;
        _imageCreationGateway = imageCreationGateway;
        _searchRepository = searchRepository;
        _persistentCache = persistentCache;
        _logger = logger;
    }

    /// <summary>
    /// Get OSM user trace
    /// </summary>
    /// <param name="id">The trace id</param>
    /// <returns>A trace converted to data container</returns>
    [HttpGet("{id}")]
    // This is still needed until the following is solved: https://github.com/openstreetmap/openstreetmap-website/issues/5639
    public async Task<DataContainerPoco> GetTraceById(int id)
    {
        var gateway = OsmAuthFactoryWrapper.ClientFromUser(User, _clientsFactory);
        var file = await gateway.GetTraceData(id);
        await using var memoryStream = new MemoryStream();
        await file.Stream.CopyToAsync(memoryStream);
        var dataContainer = await _dataContainerConverterService.ToDataContainer(memoryStream.ToArray(), file.FileName);
        return dataContainer;
    }

    /// <summary>
    /// Creates an image for a trace
    /// </summary>
    /// <param name="id"></param>
    /// <returns></returns>
    [ResponseCache(Duration = 31536000)]
    [HttpGet("{id}/picture")]
    public async Task<IActionResult> GetTraceByIdImage(int id)
    {
        var container = await GetTraceById(id);
        container.BaseLayer = new LayerData();
        var image = await _imageCreationGateway.Create(container, 128, 128);
        return new FileContentResult(image, new MediaTypeHeaderValue("image/png"));
    }

    /// <summary>
    /// Allows upload of traces to OSM
    /// </summary>
    /// <returns></returns>
    [HttpPost]
    [Route("route")]
    public async Task<IActionResult> PostUploadRouteData([FromBody] RouteData routeData, [FromQuery]string language)
    {
        var allPoints = routeData.Segments.SelectMany(s => s.Latlngs).Select(l => l.ToCoordinate()).ToList();
        if (allPoints.Count < 2)
        {
            return BadRequest("There are not enough points in the route");
        }

        if (_persistentCache.GetString(routeData.Id) != null)
        {
            _logger.LogInformation($"Trace with ID {routeData.Id} was already uploaded in the past, returning OK");
            return Ok();
        }
        _logger.LogInformation($"Uploading trace with ID {routeData.Id}");
        _persistentCache.SetString(routeData.Id, "Uploading a trace", new DistributedCacheEntryOptions { AbsoluteExpirationRelativeToNow = TimeSpan.FromDays(10) });
        var bytes = await  _dataContainerConverterService.ToAnyFormat(new DataContainerPoco { Routes = [routeData] }, FlowFormats.GPX_SINGLE_TRACK);
        await using var memoryStream = new MemoryStream(bytes);
        var gateway = OsmAuthFactoryWrapper.ClientFromUser(User, _clientsFactory);
        var description = await GetDescriptionByArea(language, allPoints, routeData.Name);
        await gateway.CreateTrace(new GpxFile
        {
            Name = routeData.Name + "." + FlowFormats.GPX,
            Description = description,
            Visibility = Visibility.Trackable
        }, memoryStream);
        return Ok();
    }

    private async Task<string> GetDescriptionByArea(string language, List<Coordinate> allPoints, string defaultDescription)
    {
        var containerName = await _searchRepository.GetContainerName(allPoints.ToArray(), language);
        if (string.IsNullOrEmpty(containerName))
        {
            return defaultDescription;
        }
        return defaultDescription.Replace("Recorded using IHM at", containerName);
    }

    private Trace GpxFileToTrace(GpxFile gpxFile)
    {
        return new Trace
        {
            Id = gpxFile.Id.ToString(),
            Name = gpxFile.Name,
            Description = gpxFile.Description,
            ImageUrl = $"{Branding.BASE_URL}/api/osm/trace/{gpxFile.Id}/picture",
            Url = $"https://www.openstreetmap.org/user/{gpxFile.User}/traces/{gpxFile.Id}",
            TagsString = string.Join(",", gpxFile.Tags),
            TimeStamp = gpxFile.TimeStamp,
            Visibility = gpxFile.Visibility?.ToString().ToLower()
        };
    }

    private GpxFile TraceToGpxFile(Trace trace)
    {
        return new GpxFile
        {
            Id = int.Parse(trace.Id),
            Name = trace.Name,
            Description = trace.Description,
            Tags = trace.TagsString?.Split(",", StringSplitOptions.RemoveEmptyEntries).ToArray() ?? [],
            TimeStamp = trace.TimeStamp,
            Visibility = Enum.Parse<Visibility>(trace.Visibility, true)
        };
    }
}