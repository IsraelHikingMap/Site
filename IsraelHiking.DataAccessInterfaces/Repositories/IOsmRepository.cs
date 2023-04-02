using System.Collections.Generic;
using System.Threading.Tasks;
using OsmSharp.Complete;
using System.IO;

namespace IsraelHiking.DataAccessInterfaces.Repositories
{
    public interface IOsmRepository
    {
        Task<List<CompleteWay>> GetAllHighways(Stream osmFileStream);
        Task<List<ICompleteOsmGeo>> GetPoints(Stream osmFileStream, List<KeyValuePair<string, string>> tags);
        Task<List<string>> GetImagesUrls(Stream osmFileStream);
    }
}