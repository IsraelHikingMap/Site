using System.Threading.Tasks;
using OsmSharp.Osm;

namespace IsraelHiking.DataAccessInterfaces
{
    public interface IOsmGateway: IRemoteFileFetcherGateway
    {
        Task<string> GetUserId();
        Task<string> CreateChangeset();
        Task<string> CreateNode(string changesetId, Node node);
        Task<string> CreateWay(string changesetId, Way way);
        Task CloseChangeset(string changesetId);
    }
}