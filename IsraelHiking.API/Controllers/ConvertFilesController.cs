using GeoJSON.Net.Feature;
using GeoJSON.Net.Geometry;
using IsraelHiking.DataAccessInterfaces;
using IsraelHiking.Gpx;
using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Net.Http;
using System.Threading.Tasks;
using System.Web.Http;
using System.Web.Http.Description;
using System.Xml.Serialization;
using IsraelHiking.API.Gpx;
using Newtonsoft.Json;

namespace IsraelHiking.API.Controllers
{
    public class ConvertFilesController : ApiController
    {
        private double TOLERANCE = 0.001;

        private readonly ILogger _logger;
        private readonly IGpsBabelGateway _gpsBabelGateway;
        private readonly IElevationDataStorage _elevationDataStorage;
        private readonly IRemoteFileFetcherGateway _remoteFileFetcher;
        private readonly IGpxGeoJsonConverter _gpxGeoJsonConverter;

        public ConvertFilesController(ILogger logger, 
            IGpsBabelGateway gpsBabelGateway, 
            IElevationDataStorage elevationDataStorage,
            IRemoteFileFetcherGateway remoteFileFetcher, 
            IGpxGeoJsonConverter gpxGeoJsonConverter)
        {
            _gpsBabelGateway = gpsBabelGateway;
            _logger = logger;
            _elevationDataStorage = elevationDataStorage;
            _remoteFileFetcher = remoteFileFetcher;
            _gpxGeoJsonConverter = gpxGeoJsonConverter;
        }

        // GET api/ConvertFiles?url=http://jeeptrip.co.il/routes/pd6bccre.twl
        public async Task<FeatureCollection> GetRemoteFile(string url)
        {
            var response = await _remoteFileFetcher.GetFileContent(url);
            var inputFormat = ConvertExtenstionToFormat(Path.GetExtension(response.FileName));
            var convertedGpx = await _gpsBabelGateway.ConvertFileFromat(response.Content, inputFormat, ConvertExtenstionToFormat(".gpx"));
            var featureCollection = ConvertGpxContentToGeoJson(convertedGpx);
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
            var fileName = streamProvider.Contents.First().Headers.ContentDisposition.FileName.Trim('"');
            var inputFormat = ConvertExtenstionToFormat(Path.GetExtension(fileName));
            outputFormat = ConvertExtenstionToFormat(outputFormat);
            var content = await streamProvider.Contents.First().ReadAsByteArrayAsync();
            if (inputFormat == outputFormat)
            {
                return Ok(content);
            }
            if (inputFormat.Equals("geojson", StringComparison.InvariantCultureIgnoreCase))
            {
                content = ConverGeoJsonContentToGpx(content);
                inputFormat = ConvertExtenstionToFormat(".gpx");
            }
            if (outputFormat.Equals("geojson", StringComparison.InvariantCultureIgnoreCase))
            {
                var convertedGpx = await _gpsBabelGateway.ConvertFileFromat(content, inputFormat, ConvertExtenstionToFormat(".gpx"));
                var featureCollection = ConvertGpxContentToGeoJson(convertedGpx);
                return Ok(featureCollection);
            }
            var outputContent = await _gpsBabelGateway.ConvertFileFromat(content, inputFormat, outputFormat);
            return Ok(outputContent);
        }

        private string ConvertExtenstionToFormat(string extension)
        {
            extension = extension.ToLower().Replace(".", "");
            if (string.IsNullOrWhiteSpace(extension))
            {
                return "geojson";
            }
            if (extension == "twl")
            {
                return "naviguide";
            }
            if (extension == "gpx")
            {
                return "gpx,gpxver=1.1";
            }
            return extension;
        }

        private FeatureCollection ConvertGpxContentToGeoJson(byte[] content)
        {
            using (var stream = new MemoryStream(content))
            {
                XmlSerializer xmlSerializer = new XmlSerializer(typeof (gpxType));
                var gpx = xmlSerializer.Deserialize(stream) as gpxType;
                var collection = _gpxGeoJsonConverter.ConvertToGeoJson(gpx);
                UpdateZeroOrNullElevation(collection);
                return collection;
            }
        }

        private byte[] ConverGeoJsonContentToGpx(byte[] content)
        {
            using (var outputStream = new MemoryStream())
            using (var stream = new MemoryStream(content))
            {
                var serializer = new JsonSerializer();

                using (var sr = new StreamReader(stream))
                using (var jsonTextReader = new JsonTextReader(sr))
                {
                    var collection = serializer.Deserialize<FeatureCollection>(jsonTextReader);
                    var gpx = _gpxGeoJsonConverter.ConverToGpx(collection);
                    XmlSerializer xmlSerializer = new XmlSerializer(typeof(gpxType));
                    xmlSerializer.Serialize(outputStream, gpx);
                    return outputStream.ToArray();
                }
            }
        }

        private void UpdateZeroOrNullElevation(FeatureCollection featureCollection)
        {
            foreach (var feature in featureCollection.Features)
            {
                var point = feature.Geometry as Point;
                if (point != null)
                {
                    point.Coordinates = UpdateGeoPositions(new[] { point.Coordinates as GeographicPosition }).FirstOrDefault();
                }
                
                var lineString = feature.Geometry as LineString;
                if (lineString != null)
                {
                    lineString.Coordinates = UpdateGeoPositions(lineString.Coordinates.OfType<GeographicPosition>().ToArray()).Cast<IPosition>().ToList();
                }

                var multiLineString = feature.Geometry as MultiLineString;
                if (multiLineString != null)
                {
                    foreach (var currentLineString in multiLineString.Coordinates)
                    {
                        currentLineString.Coordinates = UpdateGeoPositions(currentLineString.Coordinates.OfType<GeographicPosition>().ToArray()).Cast<IPosition>().ToList();
                    }
                }


            }
        }

        private GeographicPosition[] UpdateGeoPositions(GeographicPosition[] positions)
        {
            if (positions == null)
            {
                return null;
            }
            var updatedPositions = new List<GeographicPosition>();
            foreach (var geographicPosition in positions)
            {
                if (geographicPosition == null)
                {
                    updatedPositions.Add(null);
                }
                else if (geographicPosition.Altitude == null || Math.Abs(geographicPosition.Altitude.Value) < TOLERANCE)
                {
                    updatedPositions.Add(new GeographicPosition(geographicPosition.Latitude, geographicPosition.Longitude, _elevationDataStorage.GetElevation(geographicPosition.Latitude, geographicPosition.Longitude)));
                }
                else
                {
                    updatedPositions.Add(geographicPosition);
                }
            }

            return updatedPositions.ToArray();
        }
    }
}
