using IsraelHiking.API.Services;
using IsraelHiking.Common.DataContainer;
using IsraelHiking.Common.Extensions;
using IsraelHiking.DataAccessInterfaces;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using System;
using System.Collections.Generic;
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

        /// <summary>
        /// Controller's constructor
        /// </summary>
        /// <param name="elevationGateway"></param>
        /// <param name="remoteFileFetcherGateway"></param>
        /// <param name="dataContainerConverterService"></param>
        /// <param name="offlineFilesService"></param>
        public FilesController(IElevationGateway elevationGateway,
            IRemoteFileFetcherGateway remoteFileFetcherGateway,
            IDataContainerConverterService dataContainerConverterService,
            IOfflineFilesService offlineFilesService)
        {
            _elevationGateway = elevationGateway;
            _remoteFileFetcherGateway = remoteFileFetcherGateway;
            _dataContainerConverterService = dataContainerConverterService;
            _offlineFilesService = offlineFilesService;
        }

        /// <summary>
        /// Gets a file from an external Url and converts it to <see cref="DataContainerPoco"/>
        /// </summary>
        /// <param name="url">The url to fetch the file from</param>
        /// <returns>A data container after convertion</returns>
        [HttpGet]
        // GET api/files?url=http://jeeptrip.co.il/routes/pd6bccre.twl
        public async Task<DataContainerPoco> GetRemoteFile(string url)
        {
            var response = await _remoteFileFetcherGateway.GetFileContent(url);
            var dataContainer = await ConvertToDataContainer(response.Content, response.FileName);
            return dataContainer;
        }

        /// <summary>
        /// Converts <see cref="DataContainerPoco"/> (client side presention) to any given format.
        /// </summary>
        /// <param name="format">The format to convert to</param>
        /// <param name="dataContainer">The container to convert</param>
        /// <returns>A byte representation of file in the converted format</returns>
        [HttpPost]
        // POST api/files?format=gpx
        public Task<byte[]> PostConvertFile(string format, [FromBody]DataContainerPoco dataContainer)
        {
            return _dataContainerConverterService.ToAnyFormat(dataContainer, format);
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
            if (file == null)
            {
                return BadRequest();
            }
            using var memoryStream = new MemoryStream();
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
        public Task<Dictionary<string, DateTime>> GetOfflineFiles([FromQuery] DateTime lastModified)
        {
            return _offlineFilesService.GetUpdatedFilesList(User.Identity.Name, lastModified);
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
            var file = await _offlineFilesService.GetFileContent(User.Identity.Name, id);
            return File(file, "application/zip", id);
        }
    }
}
