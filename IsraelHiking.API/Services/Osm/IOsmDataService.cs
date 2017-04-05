using System;
using System.Threading.Tasks;

namespace IsraelHiking.API.Services.Osm
{
    /// <summary>
    /// Operations used for command line
    /// </summary>
    [Flags]
    public enum OsmDataServiceOperations
    {
        /// <summary>
        /// Don't do anything 
        /// </summary>
        None = 0,
        /// <summary>
        /// Download the OSM file from the server if needed
        /// </summary>
        GetOsmFile = 1,
        /// <summary>
        /// Update Elastic Search Repository
        /// </summary>
        UpdateElasticSearch = 2,
        /// <summary>
        /// Update GraphHopper repository
        /// </summary>
        UpdateGraphHopper = 4,
        /// <summary>
        /// Do All the possible operations
        /// </summary>
        All = GetOsmFile | UpdateElasticSearch | UpdateGraphHopper
    }

    /// <summary>
    /// This servise is responsible for analyzing OSM data and updating the local repositories
    /// </summary>
    public interface IOsmDataService
    {
        /// <summary>
        /// Initializes the service.
        /// </summary>
        Task Initialize(string serverPath);
        /// <summary>
        /// Gets and updates the OSM data in a local repositories
        /// </summary>
        /// <param name="operations">The operations to perform on the data</param>
        /// <returns></returns>
        Task UpdateData(OsmDataServiceOperations operations);
    }
}