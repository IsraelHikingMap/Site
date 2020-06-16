using System.Threading.Tasks;

namespace IsraelHiking.API.Executors
{
    /// <summary>
    /// This class is responsible for updating and rebuilding external sources
    /// </summary>
    public interface IExternalSourceUpdaterExecutor
    {
        /// <summary>
        /// Rebuilds a source
        /// </summary>
        /// <param name="currentSource"></param>
        /// <returns></returns>
        Task RebuildSource(string currentSource);
        /// <summary>
        /// Updates a source from the last time it was updated (most recent updated item in the current source)
        /// </summary>
        /// <param name="currentSource"></param>
        /// <returns></returns>
        Task UpdateSource(string currentSource);
    }
}