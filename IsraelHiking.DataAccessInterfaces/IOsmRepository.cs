using System.Collections.Generic;
using System.Threading.Tasks;
using OsmSharp.Complete;
using System.IO;
using OsmSharp;

namespace IsraelHiking.DataAccessInterfaces
{
    public interface IOsmRepository
    {
        Task<Dictionary<string, List<ICompleteOsmGeo>>> GetElementsWithName(Stream osmFileStream);
        Task<List<CompleteWay>> GetAllHighways(Stream osmFileStream);
        Task<List<Node>> GetPointsWithNoNameByTags(Stream osmFileStream, List<KeyValuePair<string, string>> tags);
        Task<List<string>> GetImagesUrls(Stream osmFileStream);
    }
}