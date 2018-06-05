using System.Collections.Generic;
using System.IO;
using System.Threading.Tasks;
using GeoAPI.Geometries;
using IsraelHiking.Common;
using NetTopologySuite.Features;

namespace IsraelHiking.API.Services.Poi
{
    /// <summary>
    /// This class represent a POI adapter.
    /// </summary>
    public interface IPointsOfInterestAdapter
    {
        /// <summary>
        /// The source of the POIs
        /// </summary>
        string Source { get; }

        /// <summary>
        /// This method should be used to get more information on a given POI
        /// </summary>
        /// <param name="id">The POI's ID</param>
        /// <param name="language">The relevant language</param>
        /// <returns>A POI with more data</returns>
        Task<PointOfInterestExtended> GetPointOfInterestById(string id, string language);

        /// <summary>
        /// Get all the points from the adapter in order to index them in a database
        /// </summary>
        /// <returns></returns>
        Task<List<Feature>> GetPointsForIndexing();
    }
}
