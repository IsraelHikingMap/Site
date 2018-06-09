using System.Collections.Generic;

namespace IsraelHiking.API.Services.Poi
{
    /// <summary>
    /// This class is responsible for maintining a list of point of interest adapters
    /// </summary>
    public interface IPointsOfInterestAdapterFactory
    {
        /// <summary>
        /// This method is used to get an adapter by its source
        /// </summary>
        /// <param name="source"></param>
        /// <returns></returns>
        IPointsOfInterestAdapter GetBySource(string source);

        /// <summary>
        /// This method is used to get all the adapeters
        /// </summary>
        /// <returns></returns>
        IEnumerable<IPointsOfInterestAdapter> GetAll();

    }
}