using IsraelHiking.Common;
using System.Threading.Tasks;

namespace IsraelHiking.DataAccessInterfaces
{
    public interface IRemoteFileFetcherGateway
    {
        Task<RemoteFileFetcherGatewayResponse> GetFileContent(string url);
    }
}