using System.Text.RegularExpressions;
using GeoAPI.Geometries;

namespace IsraelHiking.API.Converters.CoordinatesParsers
{
    /// <summary>
    /// This class will parse DMS wgs84 coordinates string, assuming north-south and then east-west
    /// </summary>
    public class DegreesMinutesSecondsLatLonParser : BaseCoordinatesParser
    {
        /// <summary>
        /// Minutes symbol characters string (not a regex)
        /// </summary>
        public const string MINUTES_SYMBOLS_STRING = @"\u0027\u00b4\u02b9\u02bc\u02ca\u201d\u2032\u275c";
        /// <summary>
        /// Seconds symbol characters string (not a regex)
        /// </summary>
        public const string SECONDS_SYMBOL_STRING = @"\u0022\u02ba\u201d\u2033\u275e\u3003\u301e";
        /// <summary>
        /// Degrees regex string
        /// </summary>
        public const string ANY_DEGREES_REGEX_STRING = @"([\d\.°" + MINUTES_SYMBOLS_STRING + SECONDS_SYMBOL_STRING + @":\s]+)";
        /// <summary>
        /// Degrees regex string with north-south postfix
        /// </summary>
        public const string NORTH_SOUTH_REGEX_STRING = ANY_DEGREES_REGEX_STRING + "([NS])";
        /// <summary>
        /// Degrees regex string with east-west postfix
        /// </summary>
        public const string EAST_WEST_REGEX_STRING = ANY_DEGREES_REGEX_STRING + "([EW])";

        private readonly Regex _degreesMinutesSecondsRegex;
        private readonly Regex _decimalDegreesRegex;
        private readonly Regex _degreesMinutesRegex;

        /// <inheritdoc/>
        public override Regex Matcher => new Regex("^" + NORTH_SOUTH_REGEX_STRING + DELIMITER_REGEX_STRING + EAST_WEST_REGEX_STRING + "$");

        /// <summary>
        /// Constructor
        /// </summary>
        public DegreesMinutesSecondsLatLonParser()
        {
            _decimalDegreesRegex = new Regex("^" + DecimalLatLonParser.DECIMAL_DEGREES_REGEX_STRING + "$");
            _degreesMinutesSecondsRegex = 
                new Regex(@"^\s*(\d{1,3})(?:[:°\s]\s*)(\d{1,2})(?:[:" + 
                          MINUTES_SYMBOLS_STRING + @"\s]\s*)(\d{1,2}(?:\.\d+)?)[:" +
                          SECONDS_SYMBOL_STRING + @"]?\s*$");
            _degreesMinutesRegex = 
                new Regex(@"^\s*(\d{1,3})(?:[:°\s]\s*)(\d{1,2}(?:\.\d+)?)[:" +
                          MINUTES_SYMBOLS_STRING + @"]?\s*$");
        }

        /// <inheritdoc/>
        protected override Coordinate GetCoordinates(Match degMinSecMatch)
        {
            var lat = GetDegreesFromString(degMinSecMatch.Groups[1].Value.Trim());
            var lon = GetDegreesFromString(degMinSecMatch.Groups[3].Value.Trim());
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

        private double GetDegreesFromString(string term)
        {
            var decDegMatch = _decimalDegreesRegex.Match(term);
            if (decDegMatch.Success)
            {
                return double.Parse(decDegMatch.Groups[1].Value);
            }

            var degMinMatch = _degreesMinutesRegex.Match(term);
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

            var degMinSecMatch = _degreesMinutesSecondsRegex.Match(term);
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
    }
}
