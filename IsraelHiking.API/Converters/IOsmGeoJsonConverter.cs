using NetTopologySuite.Features;
using OsmSharp.Osm;

namespace IsraelHiking.API.Converters
{
    public interface IOsmGeoJsonConverter
    {
        Feature ToGeoJson(ICompleteOsmGeo completeOsmGeo);
    }
}