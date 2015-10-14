using GeoJSON.Net.Feature;
using IsraelHiking.DataAccess;
using Newtonsoft.Json;
using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Net;
using System.Net.Http;
using System.Threading.Tasks;
using System.Web.Http;

namespace IsraelHiking.API.Controllers
{
    public class ConvertFilesController : ApiController
    {
        GpsBabelGateway _gpsBabelGateway;

        public ConvertFilesController()
        {
            _gpsBabelGateway = new GpsBabelGateway();
        }

        // GET api/ConvertFiles?url=http://jeeptrip.co.il/routes/pd6bccre.twl
        public async Task<string> GetRemoteFile(string url)
        {
            using (HttpClient client = new HttpClient())
            {
                var response = await client.GetAsync(url);
                var content = await response.Content.ReadAsByteArrayAsync();
                var tempFileName = Path.Combine(Path.GetTempPath(), "IsraelHikingUrl_" + DateTime.Now.ToString("yyyy-MM-dd_HH-mm-ss") + Path.GetExtension(url));
                File.WriteAllBytes(tempFileName, content);
                var convertedGpx = _gpsBabelGateway.ConvertFileFromat(tempFileName, "gpx");
                var gpxString = File.ReadAllText(convertedGpx);
                File.Delete(convertedGpx);
                File.Delete(tempFileName);
                return gpxString;
            }
        }

        // POST api/convertFilesController?outputFormat=twl
        public Task<IHttpActionResult> PostConvertFile(string outputFormat)
        {
            // HM TODO: file provider...
            string uploadedFile = "";

            var outputFile = _gpsBabelGateway.ConvertFileFromat(uploadedFile, outputFormat);

            return null;
        }
    }
}
