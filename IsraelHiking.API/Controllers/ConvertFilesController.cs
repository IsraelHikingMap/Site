using IsraelHiking.DataAccessInterfaces;
using System.IO;
using System.Linq;
using System.Net.Http;
using System.Threading.Tasks;
using System.Web.Http;
using System.Web.Http.Description;
using IsraelHiking.API.Gpx;
using IsraelHiking.API.Services;
using IsraelHiking.Common;

namespace IsraelHiking.API.Controllers
{
    public class ConvertFilesController : ApiController
    {
        private readonly ILogger _logger;
        private readonly IElevationDataStorage _elevationDataStorage;
        private readonly IRemoteFileFetcherGateway _remoteFileFetcher;
        private readonly IFileConversionService _fileConversionService;
        private readonly IGpxDataContainerConverter _gpxDataContainerConverter;

        public ConvertFilesController(ILogger logger, 
            IElevationDataStorage elevationDataStorage,
            IRemoteFileFetcherGateway remoteFileFetcher, 
            IFileConversionService fileConversionService, 
            IGpxDataContainerConverter gpxDataContainerConverter)
        {
            _logger = logger;
            _elevationDataStorage = elevationDataStorage;
            _remoteFileFetcher = remoteFileFetcher;
            _fileConversionService = fileConversionService;
            _gpxDataContainerConverter = gpxDataContainerConverter;
        }
        /// <summary>
        /// Gets a file from an external Url and converts it to data container
        /// </summary>
        /// <param name="url"></param>
        /// <returns></returns>
        // GET api/ConvertFiles?url=http://jeeptrip.co.il/routes/pd6bccre.twl
        public async Task<DataContainer> GetRemoteFile(string url)
        {
            var response = await _remoteFileFetcher.GetFileContent(url);
            var dataContainer = await _fileConversionService.ConvertAnyFormatToDataContainer(response.Content, Path.GetExtension(response.FileName));
            foreach (var latLngZ in dataContainer.routes.SelectMany(routeData => routeData.segments.SelectMany(routeSegmentData => routeSegmentData.latlngzs)))
            {
                latLngZ.z = _elevationDataStorage.GetElevation(latLngZ.lat, latLngZ.lng);
            }
            return dataContainer;
        }

        /// <summary>
        /// This function is used to save file from data conatiner (client side presention) to Gpx.
        /// </summary>
        /// <param name="dataContainer"></param>
        /// <returns></returns>
        [HttpPost]
        [Route("api/saveFile")]
        public byte[] PostSaveFile(DataContainer dataContainer)
        {
            return _gpxDataContainerConverter.ToGpx(dataContainer).ToBytes();
        }

        /// <summary>
        /// The uploaded file is converted to data container json 
        /// </summary>
        /// <returns></returns>
        [HttpPost]
        [Route("api/openFile")]
        public async Task<IHttpActionResult> PostOpenFile()
        {
            var streamProvider = new MultipartMemoryStreamProvider();
            var multipartFileStreamProvider = await Request.Content.ReadAsMultipartAsync(streamProvider);

            if (multipartFileStreamProvider.Contents.Count == 0)
            {
                return BadRequest();
            }
            var fileName = streamProvider.Contents.First().Headers.ContentDisposition.FileName.Trim('"');
            var content = await streamProvider.Contents.First().ReadAsByteArrayAsync();
            var dataContainer = await _fileConversionService.ConvertAnyFormatToDataContainer(content, Path.GetExtension(fileName));
            return Ok(dataContainer);
        }

        /// <summary>
        /// This function recieves a file and a format and converts the file to that format. the resulting byte array get translated to base64string.
        /// </summary>
        /// <param name="outputFormat"></param>
        /// <returns></returns>
        [ResponseType(typeof(byte[]))]
        // POST api/convertFiles?outputFormat=twl
        public async Task<IHttpActionResult> PostConvertFile(string outputFormat)
        {
            var streamProvider = new MultipartMemoryStreamProvider();
            var multipartFileStreamProvider = await Request.Content.ReadAsMultipartAsync(streamProvider);

            if (multipartFileStreamProvider.Contents.Count == 0)
            {
                return BadRequest();
            }
            var fileName = streamProvider.Contents.First().Headers.ContentDisposition.FileName.Trim('"');
            var content = await streamProvider.Contents.First().ReadAsByteArrayAsync();
            return Ok(await _fileConversionService.Convert(content, Path.GetExtension(fileName), outputFormat));
        }
    }
}
