using IsraelHiking.Common;

namespace IsraelHiking.API.Converters
{
    /// <summary>
    /// Converts between <see cref="gpxType"/> and <see cref="DataContainer"/>
    /// </summary>
    public interface IGpxDataContainerConverter
    {
        /// <summary>
        /// Converts from <see cref="gpxType"/> to <see cref="DataContainer"/>
        /// </summary>
        /// <param name="gpx">The GPX data to convert</param>
        /// <returns>The data container</returns>
        DataContainer ToDataContainer(gpxType gpx);
        /// <summary>
        /// Converts from <see cref="DataContainer"/> to <see cref="gpxType"/>
        /// </summary>
        /// <param name="container">The data container to convert</param>
        /// <returns>The gpx data</returns>
        gpxType ToGpx(DataContainer container);
    }
}