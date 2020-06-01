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
        /// <param name="osmFeatures"></param>
        /// <param name="externalFeatures"></param>
        /// <returns></returns>
        List<Feature> Merge(List<Feature> osmFeatures, List<Feature> externalFeatures);
    }
}