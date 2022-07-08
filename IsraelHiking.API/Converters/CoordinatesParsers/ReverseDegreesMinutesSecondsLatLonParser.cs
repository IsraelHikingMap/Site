using System;
using NetTopologySuite.Geometries;
using System.Text.RegularExpressions;

namespace IsraelHiking.API.Converters.CoordinatesParsers
{
    /// <summary>
    /// This class will parse DMS wgs84 coordinates string, assuming east-west and then north-south
    /// </summary>
    [Obsolete("Not in use any more 5.2022")]
    public class ReverseDegreesMinutesSecondsLatLonParser : ICoordinatesParser
    {
        private readonly DegreesMinutesSecondsLatLonParser _coordinatesMatcherProxy;

        /// <summary>
        /// Constructor
        /// </summary>
        public ReverseDegreesMinutesSecondsLatLonParser()
        {
            _coordinatesMatcherProxy = new DegreesMinutesSecondsLatLonParser();
        }

        /// <summary>
        /// The regular expression matcher for reverse degrees
        /// </summary>
        public Regex Matcher => new Regex("^" + DegreesMinutesSecondsLatLonParser.EAST_WEST_REGEX_STRING + 
                                          BaseCoordinatesParser.DELIMITER_REGEX_STRING + 
                                          DegreesMinutesSecondsLatLonParser.NORTH_SOUTH_REGEX_STRING  + "$");

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
            return match.Success ? _coordinatesMatcherProxy.TryParse(term) : null;
        }
    }
}
