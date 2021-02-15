using System.IO;
using System.Threading.Tasks;

namespace IsraelHiking.DataAccessInterfaces
{
    /// <summary>
    /// this gateway will allow getting the latest OSM pbf file
    /// </summary>
    public interface IOsmLatestFileGateway
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
        Task<Stream> Get();

        /// <summary>
        /// This method returns a stream with the updates after updating the file to the latest version
        /// i.e. it will get the updates between this call and the last call
        /// </summary>
        /// <returns>A Stream containting all the updates made since last "Update" was called</returns>
        Task<Stream> GetUpdates();
    }
}