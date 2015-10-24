using GeoJSON.Net.Feature;
using GeoJSON.Net.Geometry;
using IsraelHiking.DataAccess;
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
        private readonly Logger _logger;
        private readonly GpsBabelGateway _gpsBabelGateway;
        private readonly ElevationDataStorage _elevationDataStorage;

        public ConvertFilesController()
        {
            _gpsBabelGateway = new GpsBabelGateway();
            _logger = new Logger();
            _elevationDataStorage = ElevationDataStorage.Instance;
        }

        // GET api/ConvertFiles?url=http://jeeptrip.co.il/routes/pd6bccre.twl
        public async Task<FeatureCollection> GetRemoteFile(string url)
        {
            using (HttpClient client = new HttpClient())
            {
                _logger.Debug("Getting file from: " + url);
                var response = await client.GetAsync(url);
                var content = await response.Content.ReadAsByteArrayAsync();
                var tempPath = GetTemporaryPath();
                var tempFileName = Path.Combine(tempPath, "IsraelHikingUrl" + Path.GetExtension(url));
                File.WriteAllBytes(tempFileName, content);
                var convertedKml = _gpsBabelGateway.ConvertFileFromat(tempFileName, "kml");
                var featureCollection = ConvertFileToGeoJson(convertedKml);
                Directory.Delete(tempPath, true);
                _logger.Debug("File was retrieved successfully");
                return featureCollection;
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

        private FeatureCollection ConvertFileToGeoJson(string fileName)
        {
            var collection = new FeatureCollection();
            using (var stream = File.OpenRead(fileName))
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
