using System.IO;
using System.Threading.Tasks;

namespace IsraelHiking.API.Executors
{
    /// <summary>
    /// this fetcher will make sure the latest OSM file is in cache
    /// </summary>
    public interface IOsmLatestFileFetcher
    {
        /// <summary>
        /// Gets a stream to the latest OSM file
        /// </summary>
        /// <returns>The OSM file stream</returns>
        Task<Stream> Get();

        /// <summary>
        /// This method returns a stream with the updates
        /// </summary>
        /// <returns>A Stream containting all the updates made since last "Get" was called</returns>
        Task<Stream> GetUpdates();
    }
}