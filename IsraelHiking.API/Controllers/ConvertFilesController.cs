using GeoJSON.Net.Feature;
using IsraelHiking.DataAccess;
using System;
using System.Collections.Generic;
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

        public Task<FeatureCollection> GetRemoteFile(string url)
        {
            return null;
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
