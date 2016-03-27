using IsraelHiking.Common;
using System.Threading.Tasks;

namespace IsraelHiking.DataAccessInterfaces
{
    public interface IRemoteFileFetcherGateway
    {
        Task<long> GetFileSize(string url);
        Task<RemoteFileFetcherGatewayResponse> GetFileContent(string url);
    }
}