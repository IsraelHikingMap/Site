using System.Threading.Tasks;
using IsraelHiking.Common;

namespace IsraelHiking.API.Services.Poi
{
    /// <summary>
    /// This class is used to aggregate a few points of interest into one
    /// </summary>
    public interface IPointsOfInterestAggregatorService
    {
        /// <summary>
        /// Gets the aggregated point of interest using all relevant adapters
        /// </summary>
        /// <param name="source">POI source</param>
        /// <param name="id">POI ID</param>
        /// <param name="language">Required language</param>
        /// <returns></returns>
        Task<PointOfInterestExtended> Get(string source, string id, string language = "");
    }
}