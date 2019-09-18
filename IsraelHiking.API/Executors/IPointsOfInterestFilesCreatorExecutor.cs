using System.Collections.Generic;
using NetTopologySuite.Features;

namespace IsraelHiking.API.Executors
{
    /// <summary>
    /// This executor will create files that contains a set of POIs for sitemap and offline
    /// </summary>
    public interface IPointsOfInterestFilesCreatorExecutor
    {
        /// <summary>
        /// This function creates the sitemap.xml file inside the wwwroot folder
        /// </summary>
        /// <param name="features"></param>
        void Create(List<Feature> features);
    }
}