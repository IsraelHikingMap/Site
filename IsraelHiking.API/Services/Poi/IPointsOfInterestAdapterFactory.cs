using System.Collections.Generic;

namespace IsraelHiking.API.Services.Poi;

/// <summary>
/// This class is responsible for maintaining a list of point of interest adapters
/// </summary>
public interface IPointsOfInterestAdapterFactory
{
    /// <summary>
    /// This method is used to get an adapter by its source
    /// </summary>
    /// <param name="source"></param>
    /// <returns>The adapter, null if it is not found</returns>
    IPointsOfInterestAdapter GetBySource(string source);

    /// <summary>
    /// This method is used to get all the adapters
    /// </summary>
    /// <returns></returns>
    IEnumerable<IPointsOfInterestAdapter> GetAll();

}