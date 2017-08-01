using System.Collections.Generic;
using System.IO;
using System.Threading.Tasks;
using IsraelHiking.Common;
using OsmSharp;
using OsmSharp.Complete;

namespace IsraelHiking.DataAccessInterfaces
{
    public interface IOsmGateway: IRemoteFileFetcherGateway
    {
        Task<string> GetUserId();
        Task<string> CreateChangeset(string comment);
        Task<string> CreateNode(string changesetId, Node node);
        Task<string> CreateWay(string changesetId, Way way);
        Task UpdateWay(string changesetId, Way way);
        Task<CompleteWay> GetCompleteWay(string wayId);
        Task<List<OsmTrace>> GetTraces();
        Task CloseChangeset(string changesetId);
        Task CreateTrace(string fileName, MemoryStream fileStream);
        Task UpdateTrace(OsmTrace trace);
        Task DeleteTrace(string traceId);
    }
}