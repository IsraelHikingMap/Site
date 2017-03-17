using IsraelHiking.DataAccessInterfaces;
using System.Linq;
using System.Threading.Tasks;
using GeoAPI.Geometries;
using IsraelHiking.API.Services;
using IsraelHiking.Common;
using Microsoft.AspNetCore.Mvc;
using System.Collections.Generic;
using Microsoft.AspNetCore.Http;
using System.IO;

namespace IsraelHiking.API.Controllers
{
    /// <summary>
    /// This controller allows fetching of remote files, opening of files and converting files
    /// </summary>
    [Route("api/[controller]")]
    public class FilesController : Controller
    {
        private readonly IElevationDataStorage _elevationDataStorage;
        private readonly IHttpGatewayFactory _httpGatewayFactory;
        private readonly IDataContainerConverterService _dataContainerConverterService;
        private readonly LruCache<string, TokenAndSecret> _cache;

        /// <summary>
        /// Controller's constructor
        /// </summary>
        /// <param name="elevationDataStorage"></param>
        /// <param name="httpGatewayFactory"></param>
        /// <param name="dataContainerConverterService"></param>
        /// <param name="cache"></param>
        public FilesController(IElevationDataStorage elevationDataStorage,
            IHttpGatewayFactory httpGatewayFactory, 
            IDataContainerConverterService dataContainerConverterService,
            LruCache<string, TokenAndSecret> cache)
        {
            _elevationDataStorage = elevationDataStorage;
            _httpGatewayFactory = httpGatewayFactory;
            _dataContainerConverterService = dataContainerConverterService;
            _cache = cache;
        }
        /// <summary>
        /// Gets a file from an external Url and converts it to <see cref="DataContainer"/>
        /// </summary>
        /// <param name="url">The url to fetch the file from</param>
        /// <returns>A data container after convertion</returns>
        [HttpGet]
        // GET api/files?url=http://jeeptrip.co.il/routes/pd6bccre.twl
        public async Task<DataContainer> GetRemoteFile(string url)
        {
            var fetcher = _httpGatewayFactory.CreateRemoteFileFetcherGateway(_cache.Get(User.Identity.Name));
            var response = await fetcher.GetFileContent(url);
            var dataContainer = await _dataContainerConverterService.ToDataContainer(response.Content, response.FileName);
            foreach (var latLngZ in dataContainer.routes.SelectMany(routeData => routeData.segments.SelectMany(routeSegmentData => routeSegmentData.latlngzs)))
            {
                latLngZ.z = await _elevationDataStorage.GetElevation(new Coordinate().FromLatLng(latLngZ));
            }
            return dataContainer;
        }

        /// <summary>
        /// Converts <see cref="DataContainer"/> (client side presention) to any given format.
        /// </summary>
        /// <param name="format">The format to convert to</param>
        /// <param name="dataContainer">The container to convert</param>
        /// <returns>A byte representation of file in the converted format</returns>
        [HttpPost]
        // POST api/files?format=gpx
        public Task<byte[]> PostSaveFile(string format, [FromBody]DataContainer dataContainer)
        {
            return _dataContainerConverterService.ToAnyFormat(dataContainer, format);
        }

        /// <summary>
        /// Reads the uploaded file and converts it to <see cref="DataContainer"/>
        /// </summary>
        /// <returns>A <see cref="DataContainer"/> after conversion of the file uploaded</returns>
        [HttpPost]
        [Route("open")]
        public async Task<IActionResult> PostOpenFile(ICollection<IFormFile> files)
        {
            if (files.Count == 0)
            {
                return BadRequest();
            }
            using (var memoryStream = new MemoryStream())
            {
                var fileName = files.First().FileName;
                await files.First().CopyToAsync(memoryStream);
                var dataContainer = await _dataContainerConverterService.ToDataContainer(memoryStream.ToArray(), fileName);
                return Ok(dataContainer);
            }
        }
    }
}
