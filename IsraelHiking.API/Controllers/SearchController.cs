using System.Collections.ObjectModel;
using System.Linq;
using System.Threading.Tasks;
using GeoAPI.Geometries;
using IsraelHiking.API.Gpx;
using IsraelHiking.API.Services;
using IsraelHiking.Common;
using IsraelHiking.DataAccessInterfaces;
using NetTopologySuite.Features;
using Microsoft.AspNetCore.Mvc;
using System.Text.RegularExpressions;
using GeoAPI.CoordinateSystems.Transformations;
using NetTopologySuite.Geometries;

namespace IsraelHiking.API.Controllers
{
    /// <summary>
    /// This contoller allows search of geo-locations
    /// </summary>
    [Route("api/[controller]")]
    public class SearchController : Controller
    {
        private readonly IElevationDataStorage _elevationDataStorage;
        private readonly IElasticSearchGateway _elasticSearchGateway;
        private readonly IDataContainerConverterService _dataContainerConverterService;
        private readonly IMathTransform _itmWgs84MathTransform;

        /// <summary>
        /// Controller's constructor
        /// </summary>
        /// <param name="elasticSearchGateway"></param>
        /// <param name="dataContainerConverterService"></param>
        /// <param name="elevationDataStorage"></param>
        /// <param name="itmWgs84MathTransform"></param>
        public SearchController(IElasticSearchGateway elasticSearchGateway,
            IDataContainerConverterService dataContainerConverterService,
            IElevationDataStorage elevationDataStorage,
            IMathTransform itmWgs84MathTransform)
        {
            _elasticSearchGateway = elasticSearchGateway;
            _dataContainerConverterService = dataContainerConverterService;
            _elevationDataStorage = elevationDataStorage;
            _itmWgs84MathTransform = itmWgs84MathTransform;
        }

        /// <summary>
        /// Gets a geo location by search term
        /// </summary>
        /// <param name="term">A string to search for</param>
        /// <param name="language">The language to search in</param>
        /// <returns></returns>
        // GET api/search/abc&language=en
        [HttpGet]
        [Route("{term}/{northing?}")]
        public async Task<FeatureCollection> GetSearchResults(string term, string northing = null, string language = null)
        {
            if (northing != null)
            {
                term = term + "/" + northing;
            }
            var coordinatesFeature = GetCoordinates(term);
            if (coordinatesFeature != null)
            {
                return new FeatureCollection(new Collection<IFeature> { GetFeatureFromCoordinates(term, coordinatesFeature) });
            }
            var fieldName = string.IsNullOrWhiteSpace(language) ? "name" : "name:" + language;
            var features = await _elasticSearchGateway.Search(term, fieldName);
            return new FeatureCollection(new Collection<IFeature>(features.OfType<IFeature>().ToList()));
        }

        /// <summary>
        /// Converts a search results to <see cref="DataContainer"/>
        /// </summary>
        /// <param name="feature">The feature to convert</param>
        /// <returns>The converted feature</returns>
        [HttpPost]
        public async Task<DataContainer> PostConvertSearchResults([FromBody]Feature feature)
        {
            var name = "israelHiking";
            if (feature.Attributes.GetNames().Contains("name"))
            {
                name = feature.Attributes["name"].ToString();
            }
            var featureCollection = new FeatureCollection(new Collection<IFeature> { feature });
            var dataContainer = await _dataContainerConverterService.ToDataContainer(featureCollection.ToBytes(), name + ".geojson");
            foreach (var latLng in dataContainer.routes.SelectMany(routeData => routeData.segments.SelectMany(routeSegmentData => routeSegmentData.latlngs)))
            {
                latLng.alt = await _elevationDataStorage.GetElevation(new Coordinate().FromLatLng(latLng));
            }
            return dataContainer;
        }

        private Coordinate GetCoordinates(string term)
        {
            var lonLatRegEx = new Regex(@"^\s*([\d\.°'""\u2032\u2033\s]+[EW])\s*[,/\s]?\s*([\d\.°'""\u2032\u2033\s]+[NS])\s*$");
            var lonLatMatch = lonLatRegEx.Match(term);
            if (lonLatMatch.Success)
            {
                // Allow transposed lat and lon
                term = lonLatMatch.Groups[2].Value + " " + lonLatMatch.Groups[1].Value;
            }

            var degMinSecRegEx = new Regex(@"^\s*([\d\.°'""\u2032\u2033\s]+)([NS])\s*[,/\s]?\s*([\d\.°'""\u2032\u2033\s]+)([EW])\s*$");
            var degMinSecMatch = degMinSecRegEx.Match(term);
            if (degMinSecMatch.Success)
            {
                var lat = GetDecimalDegrees(degMinSecMatch.Groups[1].Value);
                var lon = GetDecimalDegrees(degMinSecMatch.Groups[3].Value);
                if (lat <= 90 && lon <= 180)
                {
                    if (degMinSecMatch.Groups[2].Value == "S")
                    {
                        lat = - lat;
                    }
                    if (degMinSecMatch.Groups[4].Value == "W")
                    {
                        lon = - lon;
                    }
                    return new Coordinate(lon, lat);
                }
                return null;
            }

            var latLonRegEx = new Regex(@"^\s*([-+]?\d{1,3}(?:\.\d+)?)°?\s*[,/\s]?\s*([-+]?\d{1,3}(?:\.\d+)?)°?\s*$");
            var latLonMatch = latLonRegEx.Match(term);
            if (latLonMatch.Success)
            {
                var lat = double.Parse(latLonMatch.Groups[1].Value);
                var lon = double.Parse(latLonMatch.Groups[2].Value);
                if (lat >= -90 && lat <= 90 && lon >= -180 && lon <= 180)
                {
                    return new Coordinate(double.Parse(latLonMatch.Groups[2].Value), double.Parse(latLonMatch.Groups[1].Value));
                }
            }

            var itmRegEx = new Regex(@"^\s*(\d{6})(?:\s*[,/]?\s*)(\d{6,7})\s*$");
            var itmMatch = itmRegEx.Match(term);
            if (itmMatch.Success)
            {
                var easting = int.Parse(itmMatch.Groups[1].Value);
                var northing = int.Parse(itmMatch.Groups[2].Value);
                if (northing < 1350000)
                {
                    if (northing < 350000)
                    {
                        easting = easting + 50000;
                        northing = northing + 500000;
                    }
                    else if (northing > 850000)
                    {
                        easting = easting + 50000;
                        northing = northing - 500000;
                    }
                    if (easting >= 100000 && easting <= 300000)
                    {
                        return _itmWgs84MathTransform.Transform(new Coordinate(double.Parse(itmMatch.Groups[1].Value), double.Parse(itmMatch.Groups[2].Value)));
                    }
                }
            }
            return null;
        }

        private double GetDecimalDegrees(string term)
        {
            var decDegRegEx = new Regex(@"^\s*(\d{1,3}(?:\.\d+)?)°?\s*$");
            var decDegMatch = decDegRegEx.Match(term);
            if (decDegMatch.Success)
            {
                return double.Parse(decDegMatch.Groups[1].Value);
            }

            var degMinRegEx = new Regex(@"^\s*(\d{1,3})(?:[°\s]\s*)(\d{1,2}(?:\.\d+)?)['\u2032']?\s*$");
            var degMinMatch = degMinRegEx.Match(term);
            if (degMinMatch.Success)
            {
                var deg = double.Parse(degMinMatch.Groups[1].Value);
                var min = double.Parse(degMinMatch.Groups[2].Value);
                if (min < 60)
                {
                    return min / 60.0 + deg;
                }
                return double.NaN;
            }

            var degMinSecRegEx = new Regex(@"^\s*(\d{1,3})(?:[°\s]\s*)(\d{1,2})(?:['\u2032\s]\s*)(\d{1,2}(?:\.\d+)?)[""\u2033]?\s*$");
            var degMinSecMatch = degMinSecRegEx.Match(term);
            if (degMinSecMatch.Success)
            {
                var deg = double.Parse(degMinSecMatch.Groups[1].Value);
                var min = double.Parse(degMinSecMatch.Groups[2].Value);
                var sec = double.Parse(degMinSecMatch.Groups[3].Value);
                if (min < 60 && sec < 60)
                {
                    return (sec / 60.0 + min) / 60.0 + deg;
                }
            }

            return double.NaN;
        }

        private Feature GetFeatureFromCoordinates(string name, Coordinate coordinates)
        {
            return new Feature(new Point(coordinates), new AttributesTable { { "name", name } });
        }
    }
}
