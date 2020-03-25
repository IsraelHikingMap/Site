using System;
using System.Collections.Generic;
using System.IO;
using System.Threading.Tasks;

namespace IsraelHiking.API.Services
{
    /// <summary>
    /// A serivce responsible for offline files location and get who was updated
    /// </summary>
    public interface IOfflineFilesService
    {
        /// <summary>
        /// Get the file's content 
        /// </summary>
        /// <param name="userId">The user id to check against</param>
        /// <param name="fileName">The file to get</param>
        /// <returns>a read stream of the file</returns>
        Task<Stream> GetFileContent(string userId, string fileName);

        /// <summary>
        /// Get a list of files that have been updated since a given date
        /// </summary>
        /// <param name="userId">The user id to check against</param>
        /// <param name="lastModifiedDate">The date to check against</param>
        /// <param name="mbTiles">Return MBTiles related files</param>
        /// <returns>A list of file names</returns>
        Task<Dictionary<string, DateTime>> GetUpdatedFilesList(string userId, DateTime lastModifiedDate, bool mbTiles);
    }
}