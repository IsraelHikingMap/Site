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
using System.Collections.Generic;
using System;

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
        private readonly List<Tuple<Regex, Func<Match, Coordinate>>> _coordinatesCheckList;
        private readonly Regex _lonBeforeLatRegex;
        private readonly Regex _degMinSecRegex;
        private readonly Regex _decDegRegex;
        private readonly Regex _degMinRegex;

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

            var itmRegex = new Regex(@"^\s*(\d{6})(?:\s*[,/]?\s*)(\d{6,7})\s*$");
            var decimalLatLonRegex = new Regex(@"^\s*([-+]?\d{1,3}(?:\.\d+)?)°?\s*[,/\s]?\s*([-+]?\d{1,3}(?:\.\d+)?)°?\s*$");
            var dmsLatLonRegex = new Regex(@"^\s*([\d\.°'""\u2032\u2033\s]+)([NS])\s*[,/\s]?\s*([\d\.°'""\u2032\u2033\s]+)([EW])\s*$");
            _lonBeforeLatRegex = new Regex(@"^\s*([\d\.°'""\u2032\u2033\s]+[EW])\s*[,/\s]?\s*([\d\.°'""\u2032\u2033\s]+[NS])\s*$");
            _degMinSecRegex = new Regex(@"^\s*(\d{1,3})(?:[°\s]\s*)(\d{1,2})(?:['\u2032\s]\s*)(\d{1,2}(?:\.\d+)?)[""\u2033]?\s*$");
            _decDegRegex = new Regex(@"^\s*(\d{1,3}(?:\.\d+)?)°?\s*$");
            _degMinRegex = new Regex(@"^\s*(\d{1,3})(?:[°\s]\s*)(\d{1,2}(?:\.\d+)?)['\u2032']?\s*$");

            _coordinatesCheckList = new List<Tuple<Regex, Func<Match, Coordinate>>>
            {
                new Tuple<Regex, Func<Match, Coordinate>>(dmsLatLonRegex, GetDmsCoordinates),
                new Tuple<Regex, Func<Match, Coordinate>>(decimalLatLonRegex, GetDecimalLatLogCoordinates),
                new Tuple<Regex, Func<Match, Coordinate>>(itmRegex, GetItmCoordinates),
            };
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
        public async Task<FeatureCollection> GetSearchResults(string term, string language = null)
        {
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
            var lonLatMatch = _lonBeforeLatRegex.Match(term);
            if (lonLatMatch.Success)
            {
                // Allow transposed lat and lon
                term = lonLatMatch.Groups[2].Value + " " + lonLatMatch.Groups[1].Value;
            }
            foreach (var tuple in _coordinatesCheckList)
            {
                var match = tuple.Item1.Match(term);
                if (!match.Success)
                {
                    continue;
                }
                var coordinates = tuple.Item2(match);
                if (coordinates != null)
                {
                    return coordinates;
                }
            }
            return null;
        }

        private Coordinate GetDmsCoordinates(Match degMinSecMatch)
        {
            var lat = GetDecimalDegrees(degMinSecMatch.Groups[1].Value);
            var lon = GetDecimalDegrees(degMinSecMatch.Groups[3].Value);
            if (lat <= 90 && lon <= 180)
            {
                if (degMinSecMatch.Groups[2].Value == "S")
                {
                    lat = -lat;
                }
                if (degMinSecMatch.Groups[4].Value == "W")
                {
                    lon = -lon;
                }
                return new Coordinate(lon, lat);
            }
            return null;
        }

        private Coordinate GetDecimalLatLogCoordinates(Match latLonMatch)
        {
            var lat = double.Parse(latLonMatch.Groups[1].Value);
            var lon = double.Parse(latLonMatch.Groups[2].Value);
            if (lat >= -90 && lat <= 90 && lon >= -180 && lon <= 180)
            {
                return new Coordinate(double.Parse(latLonMatch.Groups[2].Value), double.Parse(latLonMatch.Groups[1].Value));
            }
            return null;
        }

        private Coordinate GetItmCoordinates(Match itmMatch)
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
            return null;
        }

        private double GetDecimalDegrees(string term)
        {
            var decDegMatch = _decDegRegex.Match(term);
            if (decDegMatch.Success)
            {
                return double.Parse(decDegMatch.Groups[1].Value);
            }

            var degMinMatch = _degMinRegex.Match(term);
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

            var degMinSecMatch = _degMinSecRegex.Match(term);
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
