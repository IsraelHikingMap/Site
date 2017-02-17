using System.Collections.Generic;
using GeoAPI.Geometries;

namespace IsraelHiking.API.Executors
{
    /// <summary>
    /// This interface facilitates for prolonging a line based on original gps trace
    /// </summary>
    public interface IGpxProlongerExecutor
    {
        /// <summary>
        /// This method prolongs the line's end according to the original coordinates
        /// </summary>
        /// <param name="lineToProlong">The line to prolong</param>
        /// <param name="originalCoordinates">The original coordinates that start from the line's end</param>
        /// <param name="existingItmHighways">Existing lines in the area</param>
        /// <param name="minimalDistance">The minimal distance to another line in order to stop prolonging </param>
        /// <param name="maximalLength">The maximal length to try and prolong the line</param>
        /// <returns>A prolonged line</returns>
        ILineString ProlongLineEnd(ILineString lineToProlong, Coordinate[] originalCoordinates, IReadOnlyList<ILineString> existingItmHighways, double minimalDistance, double maximalLength);

        /// <summary>
        /// This method prolongs the line's start according to the original coordinates
        /// </summary>
        /// <param name="lineToProlong">The line to prolong</param>
        /// <param name="originalCoordinates">The original coordinates that end in the line's start position</param>
        /// <param name="existingItmHighways">Existing lines in the area</param>
        /// <param name="minimalDistance">The minimal distance to another line in order to stop prolonging </param>
        /// <param name="maximalLength">The maximal length to try and prolong the line</param>
        /// <returns>A prolonged line</returns>
        ILineString ProlongLineStart(ILineString lineToProlong, Coordinate[] originalCoordinates, IReadOnlyList<ILineString> existingItmHighways, double minimalDistance, double maximalLength);
    }
}