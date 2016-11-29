using System.Threading.Tasks;

namespace IsraelHiking.DataAccessInterfaces
{
    public interface IRemoteFileSizeFetcherGateway
    {
        Task<long> GetFileSize(string url);
    }
}
