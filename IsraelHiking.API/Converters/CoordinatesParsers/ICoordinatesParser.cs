using System;
using NetTopologySuite.Geometries;

namespace IsraelHiking.API.Converters.CoordinatesParsers
{
    /// <summary>
    /// This class will parse coordinates string
    /// </summary>
    [Obsolete("Not in use any more 5.2022")]
    public interface ICoordinatesParser
    {
        /// <summary>
        /// This method will parse coordinates string
        /// </summary>
        /// <param name="term">The string to parse</param>
        /// <returns>The parsed coordinates in wgs84, null if parse failed</returns>
        Coordinate TryParse(string term);
    }
}
