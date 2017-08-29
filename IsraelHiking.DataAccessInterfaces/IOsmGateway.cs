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
        Task<string> CreateElement(string changesetId, OsmGeo osmGeo);
        Task<Node> GetNode(string nodeId);
        Task<Way> GetWay(string wayId);
        Task<Relation> GetRelation(string relationId);
        Task<CompleteWay> GetCompleteWay(string wayId);
        Task<CompleteRelation> GetCompleteRelation(string relationId);
        Task UpdateElement(string changesetId, OsmGeo osmGeo);
        Task UpdateElement(string changesetId, ICompleteOsmGeo osmGeo);
        Task<List<OsmTrace>> GetTraces();
        Task CloseChangeset(string changesetId);
        Task CreateTrace(string fileName, MemoryStream fileStream);
        Task UpdateTrace(OsmTrace trace);
        Task DeleteTrace(string traceId);
    }
}