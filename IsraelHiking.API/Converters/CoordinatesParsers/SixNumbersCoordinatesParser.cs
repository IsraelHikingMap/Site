using System;
using NetTopologySuite.Geometries;
using System.Text.RegularExpressions;

namespace IsraelHiking.API.Converters.CoordinatesParsers
{
    /// <summary>
    /// This parser knows how to parse a 6 numbers degrees coordinates string assuming north-east
    /// </summary>
    [Obsolete("Not in use any more 5.2022")]
    public class SixNumbersCoordinatesParser : BaseCoordinatesParser
    {
        private const string INTEGER_NUMBER_STRING = @"([+-]?\d+)";

        private const string DECIMAL_NUMBER_STRING = @"(\d+\.?\d+)";


        /// <inheritdoc />
        public override Regex Matcher => new Regex(@"^\s*" + INTEGER_NUMBER_STRING + @"[\s°]\s*" +
                                                   INTEGER_NUMBER_STRING + "[" + DegreesMinutesSecondsLatLonParser.MINUTES_SYMBOLS_STRING + @"\s:]\s*" +
                                                   DECIMAL_NUMBER_STRING + "[" + DegreesMinutesSecondsLatLonParser.SECONDS_SYMBOL_STRING + @"]?\s*" +
                                                   DELIMITER_REGEX_STRING +
                                                   INTEGER_NUMBER_STRING + @"[\s°]\s*" +
                                                   INTEGER_NUMBER_STRING + "[" + DegreesMinutesSecondsLatLonParser.MINUTES_SYMBOLS_STRING + @"\s:]\s*" +
                                                   DECIMAL_NUMBER_STRING + "[" + DegreesMinutesSecondsLatLonParser.SECONDS_SYMBOL_STRING + @"]?\s*$");

        /// <inheritdoc />
        protected override Coordinate GetCoordinates(Match match)
        {
            var latitudeDegrees = double.Parse(match.Groups[1].Value);
            var latitudeMinutes = double.Parse(match.Groups[2].Value);
            var latitudeSeconds = double.Parse(match.Groups[3].Value);
            var longitudeDegrees = double.Parse(match.Groups[4].Value);
            var longitudeMinutes = double.Parse(match.Groups[5].Value);
            var longitudeSeconds = double.Parse(match.Groups[6].Value);

            return new Coordinate(longitudeDegrees + longitudeMinutes / 60 + longitudeSeconds / 3600,
                latitudeDegrees + latitudeMinutes / 60 + latitudeSeconds / 3600);
        }
    }
}
