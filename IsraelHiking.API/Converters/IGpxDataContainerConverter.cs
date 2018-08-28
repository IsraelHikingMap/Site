using IsraelHiking.API.Gpx;
using IsraelHiking.Common;
using NetTopologySuite.IO;

namespace IsraelHiking.API.Converters
{
    /// <summary>
    /// Converts between <see cref="GpxFile"/> and <see cref="DataContainer"/>
    /// </summary>
    public interface IGpxDataContainerConverter
    {
        /// <summary>
        /// Converts from <see cref="GpxFile"/> to <see cref="DataContainer"/>
        /// </summary>
        /// <param name="gpx">The GPX data to convert</param>
        /// <returns>The data container</returns>
        DataContainer ToDataContainer(GpxFile gpx);
        /// <summary>
        /// Converts from <see cref="DataContainer"/> to <see cref="GpxFile"/>
        /// </summary>
        /// <param name="container">The data container to convert</param>
        /// <returns>The gpx data</returns>
        GpxFile ToGpx(DataContainer container);
    }
}