using IsraelHiking.API.Gpx;
using IsraelHiking.Common;

namespace IsraelHiking.API.Converters
{
    /// <summary>
    /// Converts between <see cref="GpxMainObject"/> and <see cref="DataContainer"/>
    /// </summary>
    public interface IGpxDataContainerConverter
    {
        /// <summary>
        /// Converts from <see cref="GpxMainObject"/> to <see cref="DataContainer"/>
        /// </summary>
        /// <param name="gpx">The GPX data to convert</param>
        /// <returns>The data container</returns>
        DataContainer ToDataContainer(GpxMainObject gpx);
        /// <summary>
        /// Converts from <see cref="DataContainer"/> to <see cref="GpxMainObject"/>
        /// </summary>
        /// <param name="container">The data container to convert</param>
        /// <returns>The gpx data</returns>
        GpxMainObject ToGpx(DataContainer container);
    }
}