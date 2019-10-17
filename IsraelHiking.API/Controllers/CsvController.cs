using CsvHelper;
using IsraelHiking.API.Converters.ConverterFlows;
using IsraelHiking.API.Gpx;
using IsraelHiking.API.Services;
using IsraelHiking.API.Services.Poi;
using IsraelHiking.Common;
using IsraelHiking.DataAccessInterfaces;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using System.IO;
using System.Linq;
using System.Text;
using System.Text.RegularExpressions;
using System.Threading.Tasks;

namespace IsraelHiking.API.Controllers
{
    /// <summary>
    /// This controller is responsible for processing csv files
    /// </summary>
    [Route("api/[controller]")]
    public class CsvController : ControllerBase
    {
        private readonly IDataContainerConverterService _dataContainerConverterService;
        private readonly IHttpGatewayFactory _httpGatewayFactory;

        /// <summary>
        /// Constructor
        /// </summary>
        /// <param name="dataContainerConverterService"></param>
        /// <param name="httpGatewayFactory"></param>
        public CsvController(IDataContainerConverterService dataContainerConverterService, 
            IHttpGatewayFactory httpGatewayFactory)
        {
            _dataContainerConverterService = dataContainerConverterService;
            _httpGatewayFactory = httpGatewayFactory;
        }

        /// <summary>
        /// This method is used to preprocess csv files
        /// </summary>
        /// <param name="file">The file to preprocess</param>
        /// <param name="idRegExPattern">The regular expersion for the id field to fill - for example &amp;id=(\d+)</param>
        /// /// <param name="sourceImageUrl">A url to a small image representing this source</param>
        /// <param name="icon">icon to add - for example icon-tint or icon-waterfall</param>
        /// <param name="iconColor">The color for the icon - with # or just a name</param>
        /// <param name="category">the relevant category <see cref="Categories"/></param>
        /// <returns></returns>
        [HttpPost]
        public async Task<IActionResult> UploadCsv(IFormFile file, [FromQuery]string idRegExPattern, [FromQuery]string sourceImageUrl, [FromQuery]string icon = "icon-bike", [FromQuery]string iconColor = "black", [FromQuery]string category = Categories.ROUTE_BIKE)
        {
            var reader = new StreamReader(file.OpenReadStream());
            var csvReader = new CsvReader(reader);
            csvReader.Configuration.HeaderValidated = null;
            csvReader.Configuration.MissingFieldFound = null;
            var pointsOfInterest = csvReader.GetRecords<CsvPointOfInterestRow>().ToList();

            var stream = new MemoryStream();
            using (TextWriter writer = new StreamWriter(stream, Encoding.UTF8, 1024, true))
            {
                var csvWriter = new CsvWriter(writer);
                csvWriter.Configuration.HasHeaderRecord = true;
                csvWriter.WriteHeader<CsvPointOfInterestRow>();
                csvWriter.NextRecord();
                var fetcher = _httpGatewayFactory.CreateRemoteFileFetcherGateway(null);
                foreach (var csvRow in pointsOfInterest)
                {
                    if (!string.IsNullOrWhiteSpace(csvRow.FileUrl))
                    {
                        var response = await fetcher.GetFileContent(csvRow.FileUrl);
                        var geojsonBytes = await _dataContainerConverterService.Convert(response.Content,
                            response.FileName, FlowFormats.GEOJSON);
                        var geoJson = geojsonBytes.ToFeatureCollection();
                        var coordinate = geoJson.First().Geometry.Coordinate;
                        csvRow.Latitude = coordinate.Y;
                        csvRow.Longitude = coordinate.X;
                    }
                    csvRow.SourceImageUrl = sourceImageUrl;
                    csvRow.Website = csvRow.Website;
                    csvRow.Icon = icon;
                    csvRow.IconColor = iconColor;
                    csvRow.Category = category;
                    csvRow.Id = Regex.Match(csvRow.Website, idRegExPattern).Groups[1].Value;
                    csvWriter.WriteRecord(csvRow);
                    csvWriter.NextRecord();
                }

                csvWriter.Flush();
                writer.Flush();
                stream.Seek(0, SeekOrigin.Begin);
                return File(stream, "text/csv");
            }
        }
    }
}
