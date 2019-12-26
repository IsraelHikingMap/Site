using GeoAPI.Geometries;
using NetTopologySuite.Geometries;
using System.Text.RegularExpressions;

namespace IsraelHiking.API.Converters.CoordinatesParsers
{
    /// <summary>
    /// This class parses decimal coordinates in wgs84 format.
    /// </summary>
    public class DecimalLatLonParser : BaseCoordinatesParser
    {
        /// <summary>
        /// Decimal regex string for degrees
        /// </summary>
        public const string DECIMAL_DEGREES_REGEX_STRING = @"([-+]?\d{1,3}(?:\.\d+)?)°?";

        /// <inheritdoc/>
        public override Regex Matcher => new Regex("^" + DECIMAL_DEGREES_REGEX_STRING + DELIMITER_REGEX_STRING + DECIMAL_DEGREES_REGEX_STRING + "$");

        /// <inheritdoc/>
        protected override Coordinate GetCoordinates(Match latLonMatch)
        {
            var lat = double.Parse(latLonMatch.Groups[1].Value);
            var lon = double.Parse(latLonMatch.Groups[2].Value);
            if (lat >= -90 && lat <= 90 && lon >= -180 && lon <= 180)
            {
                return new Coordinate(double.Parse(latLonMatch.Groups[2].Value), double.Parse(latLonMatch.Groups[1].Value));
            }
            return null;
        }
    }
}
