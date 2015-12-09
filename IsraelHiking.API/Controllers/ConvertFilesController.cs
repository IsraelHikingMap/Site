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

namespace IsraelHiking.API.Controllers
{
    public class ConvertFilesController : ApiController
    {
        private readonly ILogger _logger;
        private readonly IGpsBabelGateway _gpsBabelGateway;
        private readonly IElevationDataStorage _elevationDataStorage;
        private readonly IRemoteFileFetcherGateway _remoteFileFetcher;

        public ConvertFilesController(ILogger logger, 
            IGpsBabelGateway gpsBabelGateway, 
            IElevationDataStorage elevationDataStorage,
            IRemoteFileFetcherGateway remoteFileFetcher)
        {
            _gpsBabelGateway = gpsBabelGateway;
            _logger = logger;
            _elevationDataStorage = elevationDataStorage;
            _remoteFileFetcher = remoteFileFetcher;
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
            var content = await streamProvider.Contents.First().ReadAsByteArrayAsync();
            if (outputFormat.Equals("geojson", StringComparison.InvariantCultureIgnoreCase))
            {
                var convertedGpx = await _gpsBabelGateway.ConvertFileFromat(content, inputFormat, ConvertExtenstionToFormat(".gpx"));
                var featureCollection = ConvertGpxContentToGeoJson(convertedGpx);
                return Ok(featureCollection);
            }
            var outputContent = await _gpsBabelGateway.ConvertFileFromat(content, inputFormat, ConvertExtenstionToFormat(outputFormat));
            return Ok(outputContent);
        }

        private string ConvertExtenstionToFormat(string extension)
        {
            extension = extension.ToLower().Replace(".", "");
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
            var collection = new FeatureCollection();
            using (var stream = new MemoryStream(content))
            {
                XmlSerializer xmlSerializer = new XmlSerializer(typeof(gpxType));
                var gpx = xmlSerializer.Deserialize(stream) as gpxType;
                foreach (var point in gpx.wpt ?? new wptType[0])
                {
                    var feature = new Feature(new Point(CreateGeoPosition(point)), CreateNameProperties(point.name));
                    collection.Features.Add(feature);
                }
                foreach (var track in gpx.trk ?? new trkType[0])
                {
                    if (track.trkseg.Length == 1)
                    {
                        var lineStringFeature = new Feature(new LineString(track.trkseg[0].trkpt.Select(point => CreateGeoPosition(point))), CreateNameProperties(track.name));
                        collection.Features.Add(lineStringFeature);
                        continue;
                    }
                    var lineStringList = new List<LineString>();
                    foreach (var segment in track.trkseg)
                    {
                        lineStringList.Add(new LineString(segment.trkpt.Select(point => CreateGeoPosition(point))));
                    }
                    var feature = new Feature(new MultiLineString(lineStringList), CreateNameProperties(track.name));
                    collection.Features.Add(feature);
                }

                foreach (var route in gpx.rte ?? new rteType[0])
                {
                    var lineStringFeature = new Feature(new LineString(route.rtept.Select(point => CreateGeoPosition(point))), CreateNameProperties(route.name));
                    collection.Features.Add(lineStringFeature);
                }
            }
            return collection;
        }

        private GeographicPosition CreateGeoPosition(wptType wayPoint)
        {
            double lat = (double)wayPoint.lat;
            double lon = (double)wayPoint.lon;
            double ele = (double)wayPoint.ele;
            if (ele != 0)
            {
                return new GeographicPosition(lat, lon, ele);
            }
            return new GeographicPosition(lat, lon, _elevationDataStorage.GetElevation(lat, lon));
        }

        private Dictionary<string, object> CreateNameProperties(string name)
        {
            var dictionary = new Dictionary<string, object>();
            dictionary.Add("name", name);
            return dictionary;
        }

    }
}
