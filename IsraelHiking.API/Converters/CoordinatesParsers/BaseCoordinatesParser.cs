using GeoAPI.Geometries;
using System.Text.RegularExpressions;

namespace IsraelHiking.API.Converters.CoordinatesParsers
{
    /// <summary>
    /// This is a base class for the coordinates parser that uses regular expression.
    /// </summary>
    public abstract class BaseCoordinatesParser : ICoordinatesParser
    {
        /// <summary>
        /// regex string for delimiter between corrdinates
        /// </summary>
        public const string DELIMITER_REGEX_STRING = @"(?:\s*[,/\s]\s*)";

        /// <summary>
        /// The regular expression to match, overide when deriving
        /// </summary>
        public abstract Regex Matcher { get; }

        /// <inheritdoc/>
        public virtual Coordinate TryParse(string term)
        {
            var match = Matcher.Match(term);
            if (match.Success)
            {
                return GetCoordinates(match);
            }
            return null;
        }

        /// <summary>
        /// This is an internal method to use when deriving
        /// </summary>
        /// <param name="match">The regular expression results</param>
        /// <returns>The parsed coordinates in wgs84, null if parse failed</returns>
        protected abstract Coordinate GetCoordinates(Match match);
    }
}
