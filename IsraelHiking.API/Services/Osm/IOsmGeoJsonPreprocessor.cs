using System.Collections.Generic;
using NetTopologySuite.Features;
using OsmSharp.Osm;

namespace IsraelHiking.API.Services.Osm
{
    public interface IOsmGeoJsonPreprocessor
    {
        Dictionary<string, List<Feature>> Preprocess(Dictionary<string, List<ICompleteOsmGeo>> osmNamesDictionary);
        List<Feature> Preprocess(List<CompleteWay> highways);
    }
}