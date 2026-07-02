using IsraelHiking.API.Services;
using IsraelHiking.Common.DataContainer;
using IsraelHiking.DataAccessInterfaces;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Logging;
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
    /// <returns></returns>
    [HttpGet]
    [Route("offline")]
    [Authorize]
    public async Task<IActionResult> GetOfflineFiles([FromQuery] DateTime lastModified, [FromQuery] long? tileX, [FromQuery] long? tileY)
    {
        if (!await _receiptValidationGateway.IsEntitled(User.Identity?.Name))
        {
            _logger.LogInformation($"Unable to get the list of offline files for user: {User.Identity?.Name} since the user is not entitled, date: {lastModified}");
            return Forbid();
        }
        _logger.LogInformation($"Getting the list of offline files for user: {User.Identity?.Name}, date: {lastModified}");
        return Ok(_offlineFilesService.GetUpdatedFilesList(lastModified, tileX, tileY));
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
        var fullPath = id;
        if (tileX.HasValue && tileY.HasValue)
        {
            fullPath = $"7/{tileX}/{tileY}/{id}";
        }
        var file = _offlineFilesService.GetFileContent(fullPath);
        return File(file, "application/octet-stream", id);
    }

    /// <summary>
    /// Check subscription
    /// </summary>
    /// <remarks>Returns true when the current user has an active (entitled) subscription.</remarks>
    /// <returns>true if the user is subscribed, false otherwise</returns>
    [HttpGet]
    [Route("subscribed")]
    [Authorize]
    public async Task<bool> IsSubscribed()
    {
        return await _receiptValidationGateway.IsEntitled(User.Identity?.Name);
    }
}