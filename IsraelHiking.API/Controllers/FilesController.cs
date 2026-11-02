using IsraelHiking.API.Services;
using IsraelHiking.Common.DataContainer;
using IsraelHiking.DataAccessInterfaces;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Logging;
using NetTopologySuite.Features;
using System;
using System.IO;
using System.Threading.Tasks;

namespace IsraelHiking.API.Controllers;

/// <summary>
/// This controller allows fetching of remote files, opening of files and converting files
/// </summary>
[Route("api/[controller]")]
[ApiController]
public class FilesController : ControllerBase
{
    private readonly IRemoteFileFetcherGateway _remoteFileFetcherGateway;
    private readonly IDataContainerConverterService _dataContainerConverterService;
    private readonly IOfflineFilesService _offlineFilesService;
    private readonly IReceiptValidationGateway _receiptValidationGateway;
    private readonly ILogger _logger;

    /// <summary>
    /// Controller's constructor
    /// </summary>
    /// <param name="remoteFileFetcherGateway"></param>
    /// <param name="dataContainerConverterService"></param>
    /// <param name="offlineFilesService"></param>
    /// <param name="receiptValidationGateway"></param>
    /// <param name="logger"></param>
    public FilesController(IRemoteFileFetcherGateway remoteFileFetcherGateway,
        IDataContainerConverterService dataContainerConverterService,
        IOfflineFilesService offlineFilesService,
        IReceiptValidationGateway receiptValidationGateway,
        ILogger logger)
    {
        _remoteFileFetcherGateway = remoteFileFetcherGateway;
        _dataContainerConverterService = dataContainerConverterService;
        _offlineFilesService = offlineFilesService;
        _receiptValidationGateway = receiptValidationGateway;
        _logger = logger;
    }

    /// <summary>
    /// Fetch a remote file
    /// </summary>
    /// <remarks>Downloads a file from an external URL and converts it to a <see cref="DataContainerPoco"/>.</remarks>
    /// <param name="url">The url to fetch the file from</param>
    /// <returns>A data container after conversion</returns>
    [HttpGet]
    // GET api/files?url=http://jeeptrip.co.il/routes/pd6bccre.twl
    public async Task<DataContainerPoco> GetRemoteFile(string url)
    {
        var response = await _remoteFileFetcherGateway.GetFileContent(url);
        var dataContainer = await ConvertToDataContainer(response.Content, response.FileName);
        return dataContainer;
    }

    /// <summary>
    /// Convert to a file format
    /// </summary>
    /// <remarks>Converts a client-side <see cref="DataContainerPoco"/> to the requested format and returns the file bytes.</remarks>
    /// <param name="format">The format to convert to</param>
    /// <param name="dataContainer">The container to convert</param>
    /// <returns>A byte representation of file in the converted format</returns>
    [HttpPost]
    // POST api/files?format=gpx
    public async Task<IActionResult> PostConvertFile(string format, [FromBody] DataContainerPoco dataContainer)
    {
        if (!_dataContainerConverterService.IsValidFormat(format))
        {
            return BadRequest($"Unsupported format {format}");
        }
        return Ok(await _dataContainerConverterService.ToAnyFormat(dataContainer, format));
    }

    /// <summary>
    /// Open an uploaded file
    /// </summary>
    /// <remarks>Reads an uploaded file and converts it to a <see cref="DataContainerPoco"/>.</remarks>
    /// <returns>A <see cref="DataContainerPoco"/> after conversion of the file uploaded</returns>
    [HttpPost]
    [Route("open")]
    [ProducesResponseType(typeof(DataContainerPoco), 200)]
    public async Task<IActionResult> PostOpenFile(IFormFile file)
    {
        if (file == null || !_dataContainerConverterService.IsValidFormat(file.FileName))
        {
            return BadRequest();
        }

        await using var memoryStream = new MemoryStream();
        var fileName = file.FileName;
        await file.CopyToAsync(memoryStream);
        var dataContainer = await ConvertToDataContainer(memoryStream.ToArray(), fileName);
        return Ok(dataContainer);
    }

    private async Task<DataContainerPoco> ConvertToDataContainer(byte[] data, string fileName)
    {
        var dataContainer = await _dataContainerConverterService.ToDataContainer(data, fileName);
        return dataContainer;
    }

    /// <summary>
    /// List outdated offline files
    /// </summary>
    /// <remarks>Returns the offline files that need downloading because they changed after the given last-modified time. Requires an entitled (subscribed) user.</remarks>
    /// <param name="lastModified">The last time this tile was downloaded</param>
    /// <param name="tileX">The tile's X coordinates, null for root</param>
    /// <param name="tileY">The tile's Y coordinates, null for root</param>
    /// <param name="routingTile">Whether the client can handle the offline routing files - the routing tile
    /// itself and, for the root, the valhalla configuration files</param>
    /// <returns></returns>
    [HttpGet]
    [Route("offline")]
    [Authorize]
    public async Task<IActionResult> GetOfflineFiles([FromQuery] DateTime lastModified, [FromQuery] long? tileX, [FromQuery] long? tileY, [FromQuery] bool routingTile = false)
    {
        if (!await _receiptValidationGateway.IsEntitled(User.Identity?.Name))
        {
            _logger.LogInformation($"Unable to get the list of offline files for user: {User.Identity?.Name} since the user is not entitled, date: {lastModified}");
            return Forbid();
        }
        _logger.LogInformation($"Getting the list of offline files for user: {User.Identity?.Name}, date: {lastModified}");
        return Ok(await _offlineFilesService.GetUpdatedFilesList(lastModified, tileX, tileY, routingTile));
    }

    /// <summary>
    /// Download an offline file
    /// </summary>
    /// <remarks>Returns the content stream of a specific offline file. Requires an entitled (subscribed) user.</remarks>
    /// <param name="id"></param>
    /// <param name="tileX">The tile's X coordinates, null for root</param>
    /// <param name="tileY">The tile's Y coordinates, null for root</param>
    /// <returns>A file stream</returns>
    [HttpGet]
    [Route("offline/{id}")]
    [Authorize]
    public async Task<IActionResult> GetOfflineFile(string id, [FromQuery] long? tileX, [FromQuery] long? tileY)
    {
        if (!await _receiptValidationGateway.IsEntitled(User.Identity?.Name))
        {
            _logger.LogInformation($"Unable to get the offline file for user: {User.Identity?.Name} since the user is not entitled, file: {id}");
            return Forbid();
        }

        _logger.LogInformation($"Getting the offline file for user: {User.Identity?.Name}, file: {id}, tileX: {tileX}, tileY: {tileY}");
        var (content, length) = await _offlineFilesService.GetFileContent(id, tileX, tileY);
        // Forward the content length so the client can report download progress, also for proxied (non-seekable) streams.
        if (length.HasValue)
        {
            Response.ContentLength = length;
        }
        return File(content, "application/octet-stream", id);
    }

    /// <summary>
    /// Get the offline areas
    /// </summary>
    /// <remarks>Returns the areas that can be downloaded for offline usage as a GeoJSON feature collection. Each area
    /// has an "id", which is what its files are asked for by, an English "name" and a "name:xx" for every other
    /// language it has a name in. They are read from a file that can be replaced while the site is running.</remarks>
    /// <returns>A GeoJSON feature collection of polygons</returns>
    [HttpGet]
    [Route("offline/areas")]
    public IActionResult GetOfflineAreas()
    {
        return PhysicalFile(_offlineFilesService.AreasFilePath, "application/json");
    }

    /// <summary>
    /// List outdated offline files of an area
    /// </summary>
    /// <remarks>Like the list of the files of a tile, for an area the client sends, where the files are cut out of the
    /// whole map along its polygon. The area is sent rather than referred to, since the areas of offline/areas can
    /// change after it was downloaded and an area the user marked is not one of them. Requires an entitled
    /// (subscribed) user. Not implemented yet.</remarks>
    /// <param name="area">The area, its polygon and its "id"</param>
    /// <param name="lastModified">The last time this area was downloaded</param>
    /// <param name="routingTile">Whether the client can handle the offline routing files</param>
    /// <returns>The names of the files that changed since then, and when they did</returns>
    [HttpPost]
    [Route("offline/area")]
    [Authorize]
    public IActionResult GetOfflineAreaFiles([FromBody] IFeature area, [FromQuery] DateTime lastModified, [FromQuery] bool routingTile = false)
    {
        return StatusCode(StatusCodes.Status501NotImplemented);
    }

    /// <summary>
    /// Download an offline file of an area
    /// </summary>
    /// <remarks>Returns the content stream of one of the files listed for an area, which is sent again along with it.
    /// Requires an entitled (subscribed) user. Not implemented yet.</remarks>
    /// <param name="id">The name of the file</param>
    /// <param name="area">The area, its polygon and its "id"</param>
    /// <returns>A file stream</returns>
    [HttpPost]
    [Route("offline/area/{id}")]
    [Authorize]
    public IActionResult GetOfflineAreaFile(string id, [FromBody] IFeature area)
    {
        return StatusCode(StatusCodes.Status501NotImplemented);
    }

    /// <summary>
    /// Get the name of a tile
    /// </summary>
    /// <remarks>The default name of a downloaded zoom 7 tile, which the user can change on the device, in the form the
    /// names of an area are in: an English "name" and a "name:xx" for every other language there is a name in.
    /// Not implemented yet.</remarks>
    /// <param name="tileX">The tile's X coordinates</param>
    /// <param name="tileY">The tile's Y coordinates</param>
    /// <returns>The names of the tile</returns>
    [HttpGet]
    [Route("offline/name")]
    public IActionResult GetOfflineTileName([FromQuery] long tileX, [FromQuery] long tileY)
    {
        return StatusCode(StatusCodes.Status501NotImplemented);
    }

    /// <summary>
    /// Check subscription
    /// </summary>
    /// <remarks>Returns true when the current user has an active (entitled) subscription. The client asks
    /// this once per launch, so the log of a subscribed user and the device reported by the client is what
    /// tells an account that is shared between people apart from one that is used from several devices.</remarks>
    /// <returns>true if the user is subscribed, false otherwise</returns>
    [HttpGet]
    [Route("subscribed")]
    [Authorize]
    public async Task<bool> IsSubscribed()
    {
        var isEntitled = await _receiptValidationGateway.IsEntitled(User.Identity?.Name);
        if (isEntitled)
        {
            var clientDetails = HttpContext?.Request.GetClientDetails() ?? ClientDetails.Unknown;
            _logger.LogInformation($"Subscribed user: {User.Identity?.Name}, device: {clientDetails.DeviceId}, client: {clientDetails.Info}");
        }
        return isEntitled;
    }
}