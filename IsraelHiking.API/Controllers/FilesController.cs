﻿using IsraelHiking.API.Services;
using IsraelHiking.Common.DataContainer;
using IsraelHiking.Common.Extensions;
using IsraelHiking.DataAccessInterfaces;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Logging;
using System;
using System.IO;
using System.Linq;
using System.Threading.Tasks;

namespace IsraelHiking.API.Controllers
{
    /// <summary>
    /// This controller allows fetching of remote files, opening of files and converting files
    /// </summary>
    [Route("api/[controller]")]
    public class FilesController : ControllerBase
    {
        private readonly IElevationGateway _elevationGateway;
        private readonly IRemoteFileFetcherGateway _remoteFileFetcherGateway;
        private readonly IDataContainerConverterService _dataContainerConverterService;
        private readonly IOfflineFilesService _offlineFilesService;
        private readonly IReceiptValidationGateway _receiptValidationGateway;
        private readonly ILogger _logger;

        /// <summary>
        /// Controller's constructor
        /// </summary>
        /// <param name="elevationGateway"></param>
        /// <param name="remoteFileFetcherGateway"></param>
        /// <param name="dataContainerConverterService"></param>
        /// <param name="offlineFilesService"></param>
        /// <param name="receiptValidationGateway"></param>
        /// <param name="logger"></param>
        public FilesController(IElevationGateway elevationGateway,
            IRemoteFileFetcherGateway remoteFileFetcherGateway,
            IDataContainerConverterService dataContainerConverterService,
            IOfflineFilesService offlineFilesService, 
            IReceiptValidationGateway receiptValidationGateway, 
            ILogger logger)
        {
            _elevationGateway = elevationGateway;
            _remoteFileFetcherGateway = remoteFileFetcherGateway;
            _dataContainerConverterService = dataContainerConverterService;
            _offlineFilesService = offlineFilesService;
            _receiptValidationGateway = receiptValidationGateway;
            _logger = logger;
        }

        /// <summary>
        /// Gets a file from an external Url and converts it to <see cref="DataContainerPoco"/>
        /// </summary>
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
        /// Converts <see cref="DataContainerPoco"/> (client side presentation) to any given format.
        /// </summary>
        /// <param name="format">The format to convert to</param>
        /// <param name="dataContainer">The container to convert</param>
        /// <returns>A byte representation of file in the converted format</returns>
        [HttpPost]
        // POST api/files?format=gpx
        public async Task<IActionResult> PostConvertFile(string format, [FromBody]DataContainerPoco dataContainer)
        {
            if (!_dataContainerConverterService.IsValidFormat(format))
            {
                return BadRequest($"Unsupported format {format}");
            }
            return Ok(await _dataContainerConverterService.ToAnyFormat(dataContainer, format));
        }

        /// <summary>
        /// Reads the uploaded file and converts it to <see cref="DataContainerPoco"/>
        /// </summary>
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
            var needUpdate = dataContainer.Routes.SelectMany(routeData => routeData.Segments
                .SelectMany(routeSegmentData => routeSegmentData.Latlngs))
                .Where(l => l.Alt.HasValue == false || l.Alt == 0).ToArray();
            var elevations = await _elevationGateway.GetElevation(needUpdate.Select(l => l.ToCoordinate()).ToArray());
            for (var index = 0; index < needUpdate.Length; index++)
            {
                needUpdate[index].Alt = elevations[index];
            }
            return dataContainer;
        }

        /// <summary>
        /// Get a list of files that need to be downloaded since they are out dated
        /// </summary>
        /// <param name="lastModified"></param>
        /// <returns></returns>
        [HttpGet]
        [Route("offline")]
        [Authorize]
        public async Task<IActionResult> GetOfflineFiles([FromQuery] DateTime lastModified)
        {
            if (!await _receiptValidationGateway.IsEntitled(User.Identity?.Name))
            {
                _logger.LogInformation($"Unable to get the list of offline files for user: {User.Identity?.Name} since the user is not entitled, date: {lastModified}");
                return Forbid();
            }
            _logger.LogInformation($"Getting the list of offline files for user: {User.Identity?.Name}, date: {lastModified}");
            return Ok(_offlineFilesService.GetUpdatedFilesList(lastModified));
        }

        /// <summary>
        /// Get a specific file
        /// </summary>
        /// <param name="id"></param>
        /// <returns></returns>
        [HttpGet]
        [Route("offline/{id}")]
        [Authorize]
        public async Task<IActionResult> GetOfflineFile(string id)
        {
            if (!await _receiptValidationGateway.IsEntitled(User.Identity?.Name))
            {
                _logger.LogInformation($"Unable to get the offline file for user: {User.Identity?.Name} since the user is not entitled, file: {id}");
                return Forbid();
            }
            _logger.LogInformation($"Getting the offline file for user: {User.Identity?.Name}, file: {id}");
            var file = _offlineFilesService.GetFileContent(id);
            return File(file, id.EndsWith("json") ? "application/json": "application/zip", id);
        }
    }
}
