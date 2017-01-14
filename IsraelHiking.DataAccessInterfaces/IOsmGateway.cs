using System.IO;
using System.Threading.Tasks;
using OsmSharp.Osm;

namespace IsraelHiking.DataAccessInterfaces
{
    public interface IOsmGateway: IRemoteFileFetcherGateway
    {
        Task<string> GetUserId();
        Task<string> CreateChangeset(string comment);
        Task<string> CreateNode(string changesetId, Node node);
        Task<string> CreateWay(string changesetId, Way way);
        Task<CompleteWay> GetCompleteWay(string wayId);
        Task CloseChangeset(string changesetId);
        Task UploadFile(string fileName, MemoryStream fileStream);
    }
}