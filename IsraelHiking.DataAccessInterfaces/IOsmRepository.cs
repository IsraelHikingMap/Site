using System.Collections.Generic;
using System.Threading.Tasks;
using OsmSharp.Complete;

namespace IsraelHiking.DataAccessInterfaces
{
    public interface IOsmRepository
    {
        Task<Dictionary<string, List<ICompleteOsmGeo>>> GetElementsWithName(string osmFilePath);
        Task<List<CompleteWay>> GetAllHighways(string osmFilePath);
    }
}