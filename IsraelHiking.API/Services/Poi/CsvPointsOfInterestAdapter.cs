using CsvHelper;
using GeoAPI.Geometries;
using IsraelHiking.API.Converters.ConverterFlows;
using IsraelHiking.API.Gpx;
using IsraelHiking.Common;
using IsraelHiking.Common.Extensions;
using IsraelHiking.DataAccessInterfaces;
using Microsoft.Extensions.FileProviders;
using Microsoft.Extensions.Logging;
using NetTopologySuite.Features;
using NetTopologySuite.Geometries;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Threading.Tasks;

namespace IsraelHiking.API.Services.Poi
{
    /// <summary>
    /// This class is used to represent a single row in a csv file to store POIs
    /// </summary>
    public class CsvPointOfInterestRow
    {
        /// <summary>
        /// The ID of the POI, should be related to the website's link somehow
        /// </summary>
        public string Id { get; set; }
        /// <summary>
        /// The title of the POI
        /// </summary>
        public string Title { get; set; }
        /// <summary>
        /// The description of the POI
        /// </summary>
        public string Description { get; set; }
        /// <summary>
        /// A link to the website for more information on the POI
        /// </summary>
        public string Website { get; set; }
        /// <summary>
        /// A link to an image showing the POI
        /// </summary>
        public string ImageUrl { get; set; }
        /// <summary>
        /// A link to an image of the source site - usually an icon or small image
        /// </summary>
        public string SourceImageUrl { get; set; }
        /// <summary>
        /// The category of the POI
        /// </summary>
        public string Category { get; set; }
        /// <summary>
        /// A link to a file that represents a route, for POI that are routes
        /// </summary>
        public string FileUrl { get; set; }
        /// <summary>
        /// The icon for the POI
        /// </summary>
        public string Icon { get; set; }
        /// <summary>
        /// The icon's color for the POI
        /// </summary>
        public string IconColor { get; set; }
        /// <summary>
        /// The latitude of the POI
        /// </summary>
        public double Latitude { get; set; }
        /// <summary>
        /// The longitude of the POI
        /// </summary>
        public double Longitude { get; set; }
    }

    /// <summary>
    /// Responsible for helping with csv files
    /// </summary>
    public class CsvPointsOfInterestAdapter : BasePointsOfInterestAdapter
    {
        /// <summary>
        /// The directory where to look for the csv files
        /// </summary>
        public const string CSV_DIRECTORY = "CSV";

        private readonly IFileProvider _fileProvider;
        private readonly IRemoteFileFetcherGateway _remoteFileFetcherGateway;

        /// <summary>
        /// The file name relevant to this adapter, set it using <see cref="SetFileName"/>
        /// </summary>
        public string FileName { get; private set;  }

        /// <inheritdoc />
        public override string Source => Path.GetFileNameWithoutExtension(FileName);

        /// <summary>
        /// Constructor, make sure to use <see cref="SetFileName"/> after constructing this
        /// </summary>
        /// <param name="dataContainerConverterService"></param>
        /// <param name="fileProvider"></param>
        /// <param name="remoteFileFetcherGateway"></param>
        /// <param name="logger"></param>
        public CsvPointsOfInterestAdapter(
            IDataContainerConverterService dataContainerConverterService,
            IFileProvider fileProvider,
            IRemoteFileFetcherGateway remoteFileFetcherGateway,
            ILogger logger
        ) :
            base(dataContainerConverterService,
            logger)
        {
            _fileProvider = fileProvider;
            _remoteFileFetcherGateway = remoteFileFetcherGateway;
        }

        /// <summary>
        /// This method is used as late initialiation for setting file name
        /// </summary>
        /// <param name="fileName"></param>
        public void SetFileName(string fileName)
        {
            FileName = fileName;
        }

        /// <inheritdoc />
        public override Task<List<Feature>> GetPointsForIndexing()
        {
            return Task.Run(() =>
            {
                _logger.LogInformation("Getting records from csv file: " + FileName);
                var pointsOfInterest = GetRecords();
                var features = pointsOfInterest.Select(ConvertCsvRowToFeature).ToList();
                _logger.LogInformation($"Got {features.Count} records from csv file: {FileName}");
                return features;
            });
        }

        private Feature ConvertCsvRowToFeature(CsvPointOfInterestRow pointOfInterest)
        {
            var geoLocation = new AttributesTable
            {
                {FeatureAttributes.LAT, pointOfInterest.Latitude},
                {FeatureAttributes.LON, pointOfInterest.Longitude},
            };
            var table = new AttributesTable
            {
                {FeatureAttributes.NAME, pointOfInterest.Title},
                {FeatureAttributes.NAME + ":" + Languages.HEBREW, pointOfInterest.Title},
                {FeatureAttributes.DESCRIPTION + ":" + Languages.HEBREW, pointOfInterest.Description},
                {FeatureAttributes.POI_GEOLOCATION, geoLocation},
                {FeatureAttributes.POI_ICON, pointOfInterest.Icon},
                {FeatureAttributes.POI_ICON_COLOR, pointOfInterest.IconColor},
                {FeatureAttributes.POI_SOURCE, Source},
                {FeatureAttributes.POI_LANGUAGE, Languages.HEBREW},
                {FeatureAttributes.POI_CATEGORY, pointOfInterest.Category},
                {FeatureAttributes.POI_SHARE_REFERENCE, pointOfInterest.FileUrl },
                {FeatureAttributes.IMAGE_URL, pointOfInterest.ImageUrl},
                {FeatureAttributes.POI_SOURCE_IMAGE_URL, pointOfInterest.SourceImageUrl},
                {FeatureAttributes.ID, pointOfInterest.Id},
                {FeatureAttributes.POI_SEARCH_FACTOR, 1.0},
                {FeatureAttributes.WEBSITE, pointOfInterest.Website}
            };
            var feature = new Feature(new Point(new Coordinate(pointOfInterest.Longitude, pointOfInterest.Latitude)), table);
            feature.SetTitles();
            feature.SetId();
            return feature;
        }

        private IEnumerable<CsvPointOfInterestRow> GetRecords()
        {
            var fileInfo = _fileProvider.GetFileInfo(Path.Combine(CSV_DIRECTORY, FileName));
            var stream = fileInfo.CreateReadStream();
            var reader = new StreamReader(stream);
            var csv = new CsvReader(reader);
            csv.Configuration.MissingFieldFound = null;
            return csv.GetRecords<CsvPointOfInterestRow>();
        }

        /// <inheritdoc />
        public override async Task<Feature> GetRawPointOfInterestById(string id)
        {
            var feature = GetRecords().Where(r => r.Id == id).Select(ConvertCsvRowToFeature).First();
            if (feature.Attributes.Exists(FeatureAttributes.POI_SHARE_REFERENCE) &&
                !string.IsNullOrWhiteSpace(feature.Attributes[FeatureAttributes.POI_SHARE_REFERENCE].ToString()))
            {
                var content = await _remoteFileFetcherGateway.GetFileContent(feature.Attributes[FeatureAttributes.POI_SHARE_REFERENCE].ToString());
                var convertedBytes = await _dataContainerConverterService.Convert(content.Content, content.FileName, FlowFormats.GEOJSON);
                feature.Geometry = convertedBytes.ToFeatureCollection().Features.FirstOrDefault()?.Geometry ?? feature.Geometry;
            }
            return feature;
        }
    }
}
