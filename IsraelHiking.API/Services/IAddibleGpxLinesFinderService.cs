using System.Collections.Generic;
using System.Threading.Tasks;
using GeoAPI.Geometries;

namespace IsraelHiking.API.Services
{
    /// <summary>
    /// Splits gpx lines into addible lines and removes duplicate parts
    /// </summary>
    public interface IAddibleGpxLinesFinderService
    {
        /// <summary>
        /// This method does the following to every line:
        /// 1. removed all the points that are close to existing lines from OSM (stored in the ES database)
        /// 2. Split the remaining lines so that after the split there are no self loops in each line
        /// 3. remove duplicate lines (caused by splitting self loops)
        /// 4. Simplify lines using Douglas-Peucker and Radial angle simplifires
        /// 5. Merge the lines back if possible
        /// </summary>
        /// <param name="gpxItmLines">The lines to manipulate</param>
        /// <returns>The lines after manupulation</returns>
        Task<IEnumerable<ILineString>> GetLines(List<ILineString> gpxItmLines);
    }
}