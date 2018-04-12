using System.Collections.Generic;
using NetTopologySuite.Features;

namespace IsraelHiking.API.Executors
{
    /// <summary>
    /// This class is responsible for merging features
    /// </summary>
    public interface IFeaturesMergeExecutor
    {
        /// <summary>
        /// This method will merge features and return a list of merged features
        /// </summary>
        /// <param name="features"></param>
        /// <returns></returns>
        List<Feature> Merge(List<Feature> features);
    }
}