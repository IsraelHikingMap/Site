using System.Collections.Generic;
using System.Threading.Tasks;
using OsmSharp.Osm;

namespace IsraelHiking.DataAccessInterfaces
{
    public interface IOsmRepository
    {
        Task<Dictionary<string, List<ICompleteOsmGeo>>> GetElementsWithName(string osmFilePath);
    }
}