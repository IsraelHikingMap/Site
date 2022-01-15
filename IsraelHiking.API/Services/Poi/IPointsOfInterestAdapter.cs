using System;
using System.Collections.Generic;
using System.Threading.Tasks;
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
        /// Get all the points from the adapter in order to index them in a database
        /// </summary>
        /// <returns></returns>
        Task<List<Feature>> GetAll();

        /// <summary>
        /// Get all the points' updates from the adapter in order to index them in a database
        /// </summary>
        /// <returns></returns>
        Task<List<Feature>> GetUpdates(DateTime lastModifiedDate);
    }
}
