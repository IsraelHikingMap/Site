using System.Collections.Generic;
using System.IO;
using System.Threading.Tasks;
using OsmSharp;
using OsmSharp.API;
using OsmSharp.Changesets;
using OsmSharp.Complete;

namespace IsraelHiking.DataAccessInterfaces
{
    public interface IOsmGateway: IRemoteFileFetcherGateway
    {
        Task<User> GetUser();
        Task<string> CreateChangeset(string comment);
        Task<DiffResult> UploadChangeset(string changesetId, OsmChange osmChange);
        Task CloseChangeset(string changesetId);

        Task<string> CreateElement(string changesetId, OsmGeo osmGeo);
        Task<ICompleteOsmGeo> GetElement(string elementId, string type);
        Task UpdateElement(string changesetId, OsmGeo osmGeo);
        Task UpdateElement(string changesetId, ICompleteOsmGeo osmGeo);

        Task<Node> GetNode(string nodeId);
        Task<Way> GetWay(string wayId);
        Task<Relation> GetRelation(string relationId);

        Task<CompleteWay> GetCompleteWay(string wayId);
        Task<CompleteRelation> GetCompleteRelation(string relationId);

        Task CreateTrace(string fileName, MemoryStream fileStream);
        Task<List<GpxFile>> GetTraces();
        Task UpdateTrace(GpxFile trace);
        Task DeleteTrace(string traceId);
    }
}