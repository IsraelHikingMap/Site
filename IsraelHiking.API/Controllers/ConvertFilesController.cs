using GeoJSON.Net.Feature;
using GeoJSON.Net.Geometry;
using IsraelHiking.DataAccessInterfaces;
using SharpKml.Engine;
using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Net.Http;
using System.Threading.Tasks;
using System.Web.Http;
using System.Web.Http.Description;

namespace IsraelHiking.API.Controllers
{
    public class ConvertFilesController : ApiController
    {
        private readonly ILogger _logger;
        private readonly IGpsBabelGateway _gpsBabelGateway;
        private readonly IElevationDataStorage _elevationDataStorage;
        private readonly IRemoveFileFetcherGateway _remoteFileFetcher;

        public ConvertFilesController(ILogger logger, 
            IGpsBabelGateway gpsBabelGateway, 
            IElevationDataStorage elevationDataStorage,
            IRemoveFileFetcherGateway remoteFileFetcher)
        {
            _gpsBabelGateway = gpsBabelGateway;
            _logger = logger;
            _elevationDataStorage = elevationDataStorage;
            _remoteFileFetcher = remoteFileFetcher;
        }

        // GET api/ConvertFiles?url=http://jeeptrip.co.il/routes/pd6bccre.twl
        public async Task<FeatureCollection> GetRemoteFile(string url)
        {
            var content = await _remoteFileFetcher.GetFileContent(url);
            var inputFormat = ConvertExtenstionToFormat(Path.GetExtension(url));
            var convertedKml = await _gpsBabelGateway.ConvertFileFromat(content, inputFormat, "kml");
            var featureCollection = ConvertContentToGeoJson(convertedKml);
            return featureCollection;
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
            var inputFormat = ConvertExtenstionToFormat(Path.GetExtension(streamProvider.Contents.First().Headers.ContentDisposition.FileName.Trim('\"')));
            var content = await streamProvider.Contents.First().ReadAsByteArrayAsync();
            var outputContent = await _gpsBabelGateway.ConvertFileFromat(content, inputFormat, outputFormat);
            return Ok(outputContent);
        }

        private string ConvertExtenstionToFormat(string extension)
        {
            extension = extension.Replace(".", "");
            if (extension == "twl")
            {
                return "naviguide";
            }
            return extension.ToLower();
        }

        private FeatureCollection ConvertContentToGeoJson(byte[] content)
        {
            var collection = new FeatureCollection();
            using (var stream = new MemoryStream(content))
            {
                var kml = KmlFile.Load(stream);
                foreach (var point in kml.Root.Flatten().OfType<SharpKml.Dom.Point>())
                {
                    var feature = new Feature(new Point(CreateGeoPosition(point.Coordinate)), CreateProperties(point.Parent));
                    collection.Features.Add(feature);
                }
                foreach (var lineString in kml.Root.Flatten().OfType<SharpKml.Dom.LineString>())
                {
                    var feature = new Feature(new LineString(lineString.Coordinates.Select(v => CreateGeoPosition(v))), CreateProperties(lineString.Parent));
                    collection.Features.Add(feature);
                }
                // HM TODO: Track?
            }
            return collection;
        }

        private GeographicPosition CreateGeoPosition(SharpKml.Base.Vector vector)
        {
            if (vector.Altitude.HasValue && vector.Altitude != 0)
            {
                return new GeographicPosition(vector.Latitude, vector.Longitude, vector.Altitude);
            }
            return new GeographicPosition(vector.Latitude, vector.Longitude, _elevationDataStorage.GetElevation(vector.Latitude, vector.Longitude));
        }

        private Dictionary<string, object> CreateProperties(SharpKml.Dom.Element element)
        {
            var dictionary = new Dictionary<string, object>();
            var placemerk = element as SharpKml.Dom.Placemark;
            if (placemerk != null)
            {
                dictionary.Add("name", placemerk.Name);
            }
            return dictionary;
        }
        
    }
}
