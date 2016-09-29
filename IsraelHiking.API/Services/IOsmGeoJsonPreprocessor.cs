using System.Collections.Generic;
using NetTopologySuite.Features;
using OsmSharp.Osm;

namespace IsraelHiking.API.Services
{
    public interface IOsmGeoJsonPreprocessor
    {
        Dictionary<string, List<Feature>> Preprocess(Dictionary<string, List<ICompleteOsmGeo>> osmNamesDictionary);
    }
}