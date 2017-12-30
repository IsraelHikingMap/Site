using System.Collections.Generic;
using GeoAPI.Geometries;

namespace IsraelHiking.API.Executors
{
    /// <summary>
    /// This interface facilitates for breaking a gpx that might have a loop into non-loop gpx lines
    /// </summary>
    public interface IGpxLoopsSplitterExecutor
    {
        /// <summary>
        /// This part of this splitter will remove line that already exsits and will split lines that are close to an exsiting line.
        /// This can be used with both OSM lines and other parts of the same GPS trace.
        /// The algorithm is faily simple - 
        /// Go over all the points in the given <see cref="ILineString"/> and look for point that are close to existingLineStrings />
        /// </summary>
        /// <param name="gpxLine">The line to manipulate</param>
        /// <param name="existingLineStrings">The lines to test agains</param>
        /// <param name="minimalMissingPartLength">The minimal length allowed to a trace that can be added</param>
        /// <param name="minimalDistanceToClosestPoint">The distace of the closest point allowed</param>
        /// <returns>a split line from the orignal line</returns>
        List<ILineString> GetMissingLines(ILineString gpxLine, IReadOnlyList<ILineString> existingLineStrings, double minimalMissingPartLength, double minimalDistanceToClosestPoint);
        /// <summary>
        /// This part of the splitter if responsible for splitting a line with a self loop.
        /// It will allway return lines that do not have self loop, but can be duplicate of one another
        /// Use <see cref="GetMissingLines"/> method to remove those duplications.
        /// </summary>
        /// <param name="gpxLine">The line to look for self loops in</param>
        /// <param name="minimalDistanceToClosestPoint">The tolerance of the distance that is considered a self loop</param>
        /// <returns>a list of lines that do not have self loops</returns>
        List<ILineString> SplitSelfLoops(ILineString gpxLine, double minimalDistanceToClosestPoint);

    }
}