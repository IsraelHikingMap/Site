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
        /// Gets a stream to the latest OSM file
        /// </summary>
        /// <param name="updateFile">Should the operation download updates for daily OSM file</param>
        /// <returns>The OSM file stream</returns>
        Task<Stream> Get(bool updateFile = true);

        /// <summary>
        /// This method returns a stream with the updates
        /// </summary>
        /// <returns>A Stream containting all the updates made since last "Get" was called</returns>
        Task<Stream> GetUpdates();
    }
}