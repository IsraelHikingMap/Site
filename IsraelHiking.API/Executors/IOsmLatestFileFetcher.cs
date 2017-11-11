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
        /// <returns></returns>
        Task<Stream> Get();
    }
}