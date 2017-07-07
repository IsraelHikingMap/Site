using System;
using System.Collections.Generic;
using System.Text;
using System.Text.RegularExpressions;
using GeoAPI.Geometries;

namespace IsraelHiking.API.Converters.CoordinatesParsers
{
    /// <summary>
    /// This class will parse DMS wgs84 coordinates string, assuming east-west and then north-south
    /// </summary>
    public class ReverseDegreesMinutesSecondsLatLonParser : ICoordinatesParser
    {
        private DegreesMinutesSecondsLatLonParser _coordinatesMatcherProxy;

        /// <summary>
        /// Constructor
        /// </summary>
        public ReverseDegreesMinutesSecondsLatLonParser()
        {
            _coordinatesMatcherProxy = new DegreesMinutesSecondsLatLonParser();
        }

        /// <inheritdoc/>
        public Regex Matcher
        {
            get
            {
                return new Regex("^" + DegreesMinutesSecondsLatLonParser.EAST_WEST_REGEX_STRING + 
                    BaseCoordinatesParser.DELIMITER_REGEX_STRING + 
                    DegreesMinutesSecondsLatLonParser.NORTH_SOUTH_REGEX_STRING  + "$");
            }
        }

        /// <inheritdoc/>
        public Coordinate TryParse(string term)
        {
            var lonLatMatch = Matcher.Match(term);
            if (lonLatMatch.Success)
            {
                // Allow transposed lat and lon
                term = lonLatMatch.Groups[3].Value + lonLatMatch.Groups[4].Value + " " + lonLatMatch.Groups[1].Value + lonLatMatch.Groups[2].Value;
            }
            var match = _coordinatesMatcherProxy.Matcher.Match(term);
            if (match.Success)
            {
                return _coordinatesMatcherProxy.TryParse(term);
            }
            return null;
        }
    }
}
