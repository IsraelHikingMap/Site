using System.Collections.Generic;
using System.Threading.Tasks;
using IsraelHiking.Common.Poi;
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
        /// Gets the feature collection relevant to this id.
        /// </summary>
        /// <param name="id"></param>
        /// <returns></returns>
        Task<Feature> GetRawPointOfInterestById(string id);

        /// <summary>
        /// Get all the points from the adapter in order to index them in a database
        /// </summary>
        /// <returns></returns>
        Task<List<Feature>> GetPointsForIndexing();
    }
}
