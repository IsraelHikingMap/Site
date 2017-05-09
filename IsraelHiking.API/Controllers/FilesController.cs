using IsraelHiking.DataAccessInterfaces;
using System.Linq;
using System.Threading.Tasks;
using GeoAPI.Geometries;
using IsraelHiking.API.Services;
using IsraelHiking.Common;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Http;
using System.IO;
using IsraelHiking.API.Swagger;
using Swashbuckle.AspNetCore.SwaggerGen;

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
            var dataContainer = await ConvertToDataContainer(response.Content, response.FileName);
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
        [ProducesResponseType(typeof(DataContainer), 200)]
        [SwaggerOperationFilter(typeof(RequiredFileUploadParams))]
        public async Task<IActionResult> PostOpenFile(IFormFile file)
        {
            if (file == null)
            {
                return BadRequest();
            }
            using (var memoryStream = new MemoryStream())
            {
                var fileName = file.FileName;
                await file.CopyToAsync(memoryStream);
                var dataContainer = await ConvertToDataContainer(memoryStream.ToArray(), fileName);
                return Ok(dataContainer);
            }
        }

        private async Task<DataContainer> ConvertToDataContainer(byte[] data, string fileName)
        {
            var dataContainer = await _dataContainerConverterService.ToDataContainer(data, fileName);
            foreach (var latLng in dataContainer.routes.SelectMany(routeData => routeData.segments.SelectMany(routeSegmentData => routeSegmentData.latlngs)))
            {
                latLng.alt = await _elevationDataStorage.GetElevation(new Coordinate().FromLatLng(latLng));
            }
            return dataContainer;
        }
    }
}
