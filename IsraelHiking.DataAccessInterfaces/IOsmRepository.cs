using System.Collections.Generic;
using System.Threading.Tasks;
using OsmSharp.Complete;
using System.IO;

namespace IsraelHiking.DataAccessInterfaces
{
    public interface IOsmRepository
    {
        Task<Dictionary<string, List<ICompleteOsmGeo>>> GetElementsWithName(Stream osmFileStream);
        Task<List<CompleteWay>> GetAllHighways(Stream osmFileStream);
    }
}