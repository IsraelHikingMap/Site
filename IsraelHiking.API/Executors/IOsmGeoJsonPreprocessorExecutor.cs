using System.Collections.Generic;
using NetTopologySuite.Features;
using OsmSharp.Complete;

namespace IsraelHiking.API.Executors
{
    /// <summary>
    /// This executor is responsible for preprocessing the OSM data for elastic search database
    /// </summary>
    public interface IOsmGeoJsonPreprocessorExecutor
    {
        /// <summary>
        /// Preprocess OSM geometry into geojson features
        /// </summary>
        /// <param name="osmNamesDictionary"></param>
        /// <returns></returns>
        Dictionary<string, List<Feature>> Preprocess(Dictionary<string, List<ICompleteOsmGeo>> osmNamesDictionary);
        /// <summary>
        /// Preprocess highways into features - line strings
        /// </summary>
        /// <param name="highways"></param>
        /// <returns></returns>
        List<Feature> Preprocess(List<CompleteWay> highways);
    }
}