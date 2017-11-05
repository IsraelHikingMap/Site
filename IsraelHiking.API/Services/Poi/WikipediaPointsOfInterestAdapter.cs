using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Text;
using System.Text.RegularExpressions;
using System.Threading.Tasks;
using GeoAPI.Geometries;
using ICSharpCode.SharpZipLib.GZip;
using IsraelHiking.API.Executors;
using IsraelHiking.Common;
using IsraelHiking.DataAccessInterfaces;
using Microsoft.Extensions.Logging;
using NetTopologySuite.Features;
using NetTopologySuite.Geometries;

namespace IsraelHiking.API.Services.Poi
{
    /// <summary>
    /// Points of interest adapter for Wikipedia data
    /// </summary>
    public class WikipediaPointsOfInterestAdapter : BasePointsOfInterestAdapter, IPointsOfInterestAdapter
    {
        private readonly IWikipediaGateway _wikipediaGateway;
        private readonly ILogger _logger;
        private readonly IRemoteFileFetcherGateway _remoteFileFetcherGateway;
        private readonly IItmWgs84MathTransfromFactory _itmWgs84MathTransfromFactory;

        /// <inheritdoc />
        public WikipediaPointsOfInterestAdapter(IElevationDataStorage elevationDataStorage,
            IElasticSearchGateway elasticSearchGateway,
            IDataContainerConverterService dataContainerConverterService,
            IWikipediaGateway wikipediaGateway,
            IHttpGatewayFactory httpGatewayFactory,
            IItmWgs84MathTransfromFactory itmWgs84MathTransfromFactory,
            ILogger logger) :
            base(elevationDataStorage, elasticSearchGateway, dataContainerConverterService)
        {
            _wikipediaGateway = wikipediaGateway;
            _logger = logger;
            _itmWgs84MathTransfromFactory = itmWgs84MathTransfromFactory;
            _remoteFileFetcherGateway = httpGatewayFactory.CreateRemoteFileFetcherGateway(null);
        }

        /// <inheritdoc />
        public string Source => Sources.WIKIPEDIA;

        /// <inheritdoc />
        public Task<PointOfInterest[]> GetPointsOfInterest(Coordinate northEast, Coordinate southWest, string[] categories, string language)
        {
            return Task.FromResult(new PointOfInterest[0]);
        }

        /// <inheritdoc />
        public async Task<PointOfInterestExtended> GetPointOfInterestById(string id, string language, string type = null)
        {
            var feature = await _wikipediaGateway.GetById(id);
            var mainFeature = feature.Features.First();
            var poiItem = await ConvertToPoiItem<PointOfInterestExtended>(mainFeature, language);
            await AddExtendedData(poiItem, mainFeature, language);
            poiItem.IsRoute = false;
            return poiItem;
        }

        /// <inheritdoc />
        public Task<PointOfInterestExtended> AddPointOfInterest(PointOfInterestExtended pointOfInterest, TokenAndSecret tokenAndSecret, string language)
        {
            throw new Exception("Wikipedia does not support adding from this site.");
        }

        /// <inheritdoc />
        public Task<PointOfInterestExtended> UpdatePointOfInterest(PointOfInterestExtended pointOfInterest, TokenAndSecret tokenAndSecret, string language)
        {
            throw new Exception("Wikipedia does not support updating from this site.");
        }

        /// <inheritdoc />
        public async Task<List<Feature>> GetPointsForIndexing(Stream memoryStream)
        {
            _logger.LogInformation("Start getting wikipedia pages for indexing");
            var startCoordinate = new Coordinate(34, 29);
            var endCoordinate = new Coordinate(36, 34);
            
            var itmToWgs84 = _itmWgs84MathTransfromFactory.Create();
            var wgs84ToItm = _itmWgs84MathTransfromFactory.CreateInverse();
            double step = 10000 * 2 / Math.Sqrt(2);
            var tasksList = new List<Task<List<Feature>>>();
            foreach (var language in Languages.Array)
            {
                var currentCoordinate = new Coordinate(startCoordinate);
                while (currentCoordinate.X < endCoordinate.X && currentCoordinate.Y < endCoordinate.Y)
                {
                    var itm = wgs84ToItm.Transform(currentCoordinate);
                    itm.X += step;
                    currentCoordinate = itmToWgs84.Transform(itm);
                    if (currentCoordinate.X > endCoordinate.X)
                    {
                        currentCoordinate.X = startCoordinate.X;
                        itm = wgs84ToItm.Transform(currentCoordinate);
                        itm.Y += step;
                        currentCoordinate = itmToWgs84.Transform(itm);
                    }
                    tasksList.Add(_wikipediaGateway.GetByLocation(currentCoordinate, language));
                }
            }
            
            _logger.LogInformation($"Created {tasksList.Count} tasks to fetch wikipedia data.");
            var lists = await Task.WhenAll(tasksList);
            var wikiFeatures = lists.SelectMany(l => l)
                .GroupBy(f => f.Attributes[FeatureAttributes.ID])
                .Select(g => g.First())
                .ToList();
            _logger.LogInformation($"Finished getting wikipedia pages for indexing, got {wikiFeatures.Count} pages.");
            return wikiFeatures;
        }

        private async Task<List<Feature>> GetPointsForIndexingBySQL()
        {
            var wikiFeatures = new List<Feature>();
            var language = "he";
            var response = await _remoteFileFetcherGateway.GetFileContent($"https://dumps.wikimedia.org/{language}wiki/latest/{language}wiki-latest-geo_tags.sql.gz");
            using (var contentStream = new MemoryStream(response.Content))
            using (var memoryStreamDecompressed = new MemoryStream())
            using (var decompressionStream = new GZipInputStream(contentStream))
            {
                decompressionStream.CopyTo(memoryStreamDecompressed);
                var bytes = memoryStreamDecompressed.ToArray();
                var sqlText = Encoding.UTF8.GetString(bytes);
                var insertLinesRegex = new Regex(@"INSERT INTO `geo_tags` VALUES (.*?);");
                var valuesRegex = new Regex(@"\((.*?)\)");
                foreach (Match lineMatch in insertLinesRegex.Matches(sqlText))
                {
                    var valuesString = lineMatch.Groups[1].Value;
                    foreach (Match valuesMatch in valuesRegex.Matches(valuesString))
                    {
                        var values = valuesMatch.Groups[1].Value.Split(',');
                        var title = string.Empty;
                        if (values.Length >= 9 && values[8] != "NULL" && values[8] != "''")
                        {
                            title = values[8];
                        }
                        var pageId = language + "_" + values[1];

                        var location = new Coordinate().FromLatLng(values[4] + "," + values[5]);
                        if (location.X < 34 || location.X > 36)
                        {
                            continue;
                        }
                        if (location.Y < 29 || location.Y > 34)
                        {
                            continue;
                        }
                        var geoLocation = new AttributesTable
                        {
                            {FeatureAttributes.LAT, location.Y},
                            {FeatureAttributes.LON, location.X}
                        };
                        var wikiPage = new Feature(new Point(location), new AttributesTable
                        {
                            {FeatureAttributes.NAME, title},
                            {FeatureAttributes.ID, pageId},
                            {FeatureAttributes.ICON, "icon-wikipedia-w"},
                            {FeatureAttributes.ICON_COLOR, "black"},
                            {FeatureAttributes.POI_SOURCE, Sources.WIKIPEDIA},
                            {FeatureAttributes.POI_CATEGORY, Categories.WIKIPEDIA},
                            {FeatureAttributes.POI_LANGUAGE, language},
                            {FeatureAttributes.POI_TYPE, string.Empty},
                            {FeatureAttributes.SEARCH_FACTOR, 1},
                            {FeatureAttributes.GEOLOCATION, geoLocation}
                        });
                        wikiFeatures.Add(wikiPage);
                    }
                }
            }
            return wikiFeatures;
        }

    }
}
