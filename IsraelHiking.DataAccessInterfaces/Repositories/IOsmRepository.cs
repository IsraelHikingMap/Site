using System.Collections.Generic;
using System.Threading.Tasks;
using OsmSharp.Complete;
using System.IO;
using OsmSharp;

namespace IsraelHiking.DataAccessInterfaces.Repositories
{
    public interface IOsmRepository
    {
        Task<List<ICompleteOsmGeo>> GetElementsWithName(Stream osmFileStream);
        Task<List<CompleteWay>> GetAllHighways(Stream osmFileStream);
        Task<List<Node>> GetPointsWithNoNameByTags(Stream osmFileStream, List<KeyValuePair<string, string>> tags);
        Task<List<string>> GetImagesUrls(Stream osmFileStream);
    }
}