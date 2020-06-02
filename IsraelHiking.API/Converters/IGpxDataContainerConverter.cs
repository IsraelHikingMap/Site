using IsraelHiking.Common.DataContainer;
using NetTopologySuite.IO;

namespace IsraelHiking.API.Converters
{
    /// <summary>
    /// Converts between <see cref="GpxFile"/> and <see cref="DataContainerPoco"/>
    /// </summary>
    public interface IGpxDataContainerConverter
    {
        /// <summary>
        /// Converts from <see cref="GpxFile"/> to <see cref="DataContainerPoco"/>
        /// </summary>
        /// <param name="gpx">The GPX data to convert</param>
        /// <returns>The data container</returns>
        DataContainerPoco ToDataContainer(GpxFile gpx);
        /// <summary>
        /// Converts from <see cref="DataContainerPoco"/> to <see cref="GpxFile"/>
        /// </summary>
        /// <param name="container">The data container to convert</param>
        /// <returns>The gpx data</returns>
        GpxFile ToGpx(DataContainerPoco container);
    }
}