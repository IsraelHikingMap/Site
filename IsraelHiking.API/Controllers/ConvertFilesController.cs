using GeoJSON.Net.Feature;
using IsraelHiking.DataAccess;
using Newtonsoft.Json;
using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Net;
using System.Net.Http;
using System.Net.Http.Headers;
using System.Threading.Tasks;
using System.Web.Http;
using System.Web.Http.Description;

namespace IsraelHiking.API.Controllers
{
    public class ConvertFilesController : ApiController
    {
        private readonly Logger _logger;
        private readonly GpsBabelGateway _gpsBabelGateway;

        public ConvertFilesController()
        {
            _gpsBabelGateway = new GpsBabelGateway();
            _logger = new Logger();
        }

        // GET api/ConvertFiles?url=http://jeeptrip.co.il/routes/pd6bccre.twl
        public async Task<string> GetRemoteFile(string url)
        {
            using (HttpClient client = new HttpClient())
            {
                var response = await client.GetAsync(url);
                var content = await response.Content.ReadAsByteArrayAsync();
                var tempPath = GetTemporaryPath();
                var tempFileName = Path.Combine(tempPath, "IsraelHikingUrl" + Path.GetExtension(url));
                File.WriteAllBytes(tempFileName, content);
                var convertedGpx = _gpsBabelGateway.ConvertFileFromat(tempFileName, "gpx");
                var gpxString = File.ReadAllText(convertedGpx);
                Directory.Delete(tempPath, true);
                return gpxString;
            }
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
            var tempPath = GetTemporaryPath();
            var streamProvider = new MultipartFileStreamProvider(tempPath);
            var multipartFileStreamProvider = await Request.Content.ReadAsMultipartAsync(streamProvider);

            if (streamProvider.FileData.Count() != 1)
            {
                Directory.Delete(tempPath, true);
                return BadRequest();
            }
            var inputFileName = Path.Combine(tempPath, streamProvider.FileData.First().Headers.ContentDisposition.FileName.Trim('\"'));
            File.Move(streamProvider.FileData.First().LocalFileName, inputFileName);
            var outputFile = _gpsBabelGateway.ConvertFileFromat(inputFileName, outputFormat);
            var bytes = File.ReadAllBytes(outputFile);
            Directory.Delete(tempPath, true);
            return Ok(bytes);
        }

        private string GetTemporaryPath()
        {
            var path = Path.Combine(Path.GetTempPath(), "IsraelHiking_" + DateTime.Now.ToString("yyyy-MM-dd_HH-mm-ss_fff"));
            Directory.CreateDirectory(path);
            return path;
        }
    }
}
