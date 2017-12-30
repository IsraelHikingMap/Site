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
        /// This method will prolong all the lines to prolong and maybe add other lines according to original coordinates
        /// </summary>
        /// <param name="input">Algorithm's input</param>
        /// <returns>Updated list of lines</returns>
        List<ILineString> Prolong(GpxProlongerExecutorInput input);
    }
}