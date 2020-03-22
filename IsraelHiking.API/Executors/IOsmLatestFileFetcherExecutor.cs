using System.IO;
using System.Threading.Tasks;

namespace IsraelHiking.API.Executors
{
    /// <summary>
    /// this fetcher will make sure the latest OSM file is in cache
    /// </summary>
    public interface IOsmLatestFileFetcherExecutor
    {
        /// <summary>
        /// Updates the osm file to latest version
        /// </summary>
        /// <param name="downloadFile">Should the operation download the daily OSM file</param>
        /// <param name="updateFile">Should the operation download updates for daily OSM file</param>
        /// <returns></returns>
        Task Update(bool downloadFile = true, bool updateFile = true);

        /// <summary>
        /// Gets a stream to the OSM file
        /// </summary>
        /// <returns>The OSM file stream</returns>
        Stream Get();

        /// <summary>
        /// This method returns a stream with the updates
        /// </summary>
        /// <returns>A Stream containting all the updates made since last "Get" was called</returns>
        Task<Stream> GetUpdates();
    }
}