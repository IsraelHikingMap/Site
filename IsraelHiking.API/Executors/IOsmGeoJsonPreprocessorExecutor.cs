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
        /// <returns>a list of preprocessed features</returns>
        List<Feature> Preprocess(Dictionary<string, List<ICompleteOsmGeo>> osmNamesDictionary);
        /// <summary>
        /// This part is responsible for adding the address field to features.
        /// It is not part of the preprocess as the containers can be fetched from different sources.
        /// It also remove the place containers
        /// </summary>
        /// <param name="features">The features to update</param>
        /// <param name="containers">The containers</param>
        /// <returns>A list a features without place containers</returns>
        List<Feature> AddAddress(List<Feature> features, List<Feature> containers);
        /// <summary>
        /// Preprocess highways into features - line strings
        /// </summary>
        /// <param name="highways"></param>
        /// <returns></returns>
        List<Feature> Preprocess(List<CompleteWay> highways);
    }
}